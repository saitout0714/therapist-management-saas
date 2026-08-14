/**
 * 顧客統合：同一オーナー内で電話番号が一致する顧客を1人にまとめる。
 *
 * 顧客はまだ店舗ごとに別レコードなので、同じ人が別店舗にも来店すると
 * 別人として扱われてしまう（会員番号も別々に持てず、来店履歴もバラバラになる）。
 * セラピストと同じく「人は共通、店舗ごとの会員番号は customer_shops」という
 * 形にする。
 *
 * 対象は「同一オーナー」内での電話番号一致に限定する。オーナーをまたいだ
 * 電話番号一致は無関係な別会社の顧客が偶然同じ番号を持っているだけの
 * ケースがある（実際に確認済み）ため、絶対にオーナーの壁を越えて統合しない。
 *
 * さらに、今回はローズカフェ／ICHIGUNのオーナーだけを対象にする。
 * 他のオーナー（アーバンスパ／新宿秘密妻など）は重複がもっと多く名前・メモの
 * 食い違いも見込まれるため、統合は別日に別途確認しながら行う。
 *
 * 各組で予約等の実績が多い側を残す側に選ぶ（付け替えの件数を最小化するため）。
 * 消える側の会員番号は customer_shops へ退避してから削除する。
 * 名前欄は今回変更しない（名前に埋め込まれた番号の整理は別作業）。
 *
 * 実行は「まだ削除されていない組だけ処理する」ため再実行可能。
 * DRY_RUN=1 で予定のみ表示。
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const DRY_RUN = process.env.DRY_RUN === '1';
// ローズカフェ・ICHIGUNのオーナーのみを対象にする（他グループは別日）
const TARGET_SHOP_NAMES = ['ローズカフェ', 'ICHIGUN'];

async function main() {
  const client = new Client({ connectionString: process.env.PRODUCTION_DATABASE_URL });
  await client.connect();

  const targetShops = await client.query(`SELECT id, owner_id FROM shops WHERE name = ANY($1)`, [TARGET_SHOP_NAMES]);
  const ownerIds = [...new Set(targetShops.rows.map((s: any) => s.owner_id).filter(Boolean))];
  if (ownerIds.length !== 1) {
    throw new Error(`対象店舗のオーナーが1つに定まりません（${ownerIds.length}件）。想定外のためスキップします。`);
  }
  const targetOwnerId = ownerIds[0];
  console.log(`■ 対象オーナー: ${targetOwnerId}（${TARGET_SHOP_NAMES.join('・')}）\n`);

  // 同一オーナー内・電話番号一致・別レコードのペアを検出（対象オーナーのみ）
  const dupes = await client.query(`
    SELECT a.id AS a_id, a.name AS a_name, a.shop_id AS a_shop_id, a.owner_id,
           b.id AS b_id, b.name AS b_name, b.shop_id AS b_shop_id,
           a.phone
    FROM customers a
    JOIN customers b ON b.phone = a.phone AND a.id < b.id
    WHERE a.phone IS NOT NULL AND a.phone <> ''
      AND a.owner_id = $1 AND b.owner_id = $1
      AND a.shop_id <> b.shop_id
  `, [targetOwnerId]);

  console.log(`■ 対象組数: ${dupes.rows.length}\n`);

  let processed = 0;
  for (const row of dupes.rows) {
    const aRes = await client.query('SELECT count(*)::int n FROM reservations WHERE customer_id=$1', [row.a_id]);
    const bRes = await client.query('SELECT count(*)::int n FROM reservations WHERE customer_id=$1', [row.b_id]);
    const aShift = aRes.rows[0].n;
    const bShift = bRes.rows[0].n;

    const primary = aShift >= bShift ? { id: row.a_id, name: row.a_name, shopId: row.a_shop_id } : { id: row.b_id, name: row.b_name, shopId: row.b_shop_id };
    const secondary = aShift >= bShift ? { id: row.b_id, name: row.b_name, shopId: row.b_shop_id } : { id: row.a_id, name: row.a_name, shopId: row.a_shop_id };

    console.log(`─── ${primary.name}（主・予約${Math.max(aShift, bShift)}件） ↔ ${secondary.name}（副・予約${Math.min(aShift, bShift)}件） ───`);

    const secExists = await client.query('SELECT id FROM customers WHERE id=$1', [secondary.id]);
    if (secExists.rows.length === 0) {
      console.log('   副側は既に統合済み（スキップ）\n');
      continue;
    }

    const secRoster = await client.query('SELECT * FROM customer_shops WHERE customer_id=$1 AND shop_id=$2', [secondary.id, secondary.shopId]);
    const secMemberNumber = secRoster.rows[0]?.member_number ?? null;
    console.log(`   退避する会員番号（副の店舗）: ${secMemberNumber ?? 'なし'}`);

    const ngConflict = await client.query(`
      SELECT count(*)::int n FROM customer_therapist_ng x
      JOIN customer_therapist_ng y ON x.therapist_id = y.therapist_id
      WHERE x.customer_id = $1 AND y.customer_id = $2
    `, [primary.id, secondary.id]);
    if (ngConflict.rows[0].n > 0) {
      console.log(`   ★NG設定が両側にあり衝突（${ngConflict.rows[0].n}件）。手動確認が必要なためスキップ\n`);
      continue;
    }

    if (DRY_RUN) {
      console.log('   （DRY_RUN のため何も変更していません）\n');
      processed++;
      continue;
    }

    await client.query('BEGIN');
    try {
      // 副の店舗の会員番号を、主のもとで作り直す
      await client.query(`
        INSERT INTO customer_shops (customer_id, shop_id, member_number)
        VALUES ($1, $2, $3)
        ON CONFLICT (customer_id, shop_id) DO UPDATE SET member_number = EXCLUDED.member_number
      `, [primary.id, secondary.shopId, secMemberNumber]);

      // 予約・NG設定を付け替え
      await client.query('UPDATE reservations SET customer_id = $1 WHERE customer_id = $2', [primary.id, secondary.id]);
      await client.query('UPDATE customer_therapist_ng SET customer_id = $1 WHERE customer_id = $2', [primary.id, secondary.id]);

      // 副の顧客行を削除（customer_shops(旧)は CASCADE で自動削除）
      await client.query('DELETE FROM customers WHERE id = $1', [secondary.id]);

      await client.query('COMMIT');
      console.log('   ✓ 統合完了\n');
      processed++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('   ★失敗（ロールバック済み）:', (err as Error).message);
      throw err;
    }
  }

  console.log(`■ 集計\n   処理: ${processed}組 / 対象: ${dupes.rows.length}組`);
  await client.end();
}

main().catch(e => {
  console.error('失敗:', e);
  process.exitCode = 1;
});
