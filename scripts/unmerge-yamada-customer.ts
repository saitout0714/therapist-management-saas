/**
 * 2026-08-14に統合した「やまだ」さん（ローズカフェ80082番↔ICHIGUN50002番）を、
 * ローズカフェ・ICHIGUNの顧客共有をやめる方針変更にともない、元の2人に分け戻す。
 *
 * 手順:
 *   1. ICHIGUN用の新しい顧客レコードを作る（名前・電話番号・会員番号50002を復元）
 *   2. ICHIGUN側の予約（1件）を新レコードへ付け替える
 *   3. 統合済みレコードの customer_shops から ICHIGUN の行を削除
 *      （ローズカフェの行だけ残す）
 *   4. 統合済みレコード側の member_number（会員番号・単一列）をローズカフェの
 *      番号(80082)に戻す（ICHIGUNの番号50002が誤って入っていたため）
 *
 * NG設定（新人NG、ローズカフェのシフトid付き）はローズカフェ専用のため、
 * 統合済みレコード側にそのまま残す（移動不要）。
 *
 * 実行は対象を名前・電話番号で厳密に特定するため、再実行しても重複しない
 * （既に分け戻し済みなら対象が見つからずスキップする）。
 * DRY_RUN=1 で予定のみ表示。
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const DRY_RUN = process.env.DRY_RUN === '1';
const MERGED_CUSTOMER_ID = 'adf6b473-534b-4dd0-b063-7aae40a77cf6';
const ICHIGUN_RESERVATION_ID = '5973ea84-d4e2-466c-914b-0f0f2f5690af';

async function main() {
  const client = new Client({ connectionString: process.env.PRODUCTION_DATABASE_URL });
  await client.connect();

  const shops = await client.query(`SELECT id, name FROM shops WHERE name IN ('ローズカフェ','ICHIGUN')`);
  const rose = shops.rows.find((s: any) => s.name === 'ローズカフェ')!;
  const ichi = shops.rows.find((s: any) => s.name === 'ICHIGUN')!;

  const cust = await client.query(`SELECT * FROM customers WHERE id = $1`, [MERGED_CUSTOMER_ID]);
  if (cust.rows.length === 0) {
    console.log('対象の統合済み顧客が見つかりません（既に分け戻し済みの可能性）。スキップします。');
    await client.end();
    return;
  }
  const merged = cust.rows[0];

  const roster = await client.query(`SELECT * FROM customer_shops WHERE customer_id = $1`, [MERGED_CUSTOMER_ID]);
  const ichiRoster = roster.rows.find((r: any) => r.shop_id === ichi.id);
  const roseRoster = roster.rows.find((r: any) => r.shop_id === rose.id);

  if (!ichiRoster) {
    console.log('ICHIGUN側の在籍行が見つかりません（既に分け戻し済みの可能性）。スキップします。');
    await client.end();
    return;
  }

  const ichiRes = await client.query(`SELECT id FROM reservations WHERE customer_id = $1 AND shop_id = $2`, [MERGED_CUSTOMER_ID, ichi.id]);

  console.log('■ 実行内容\n');
  console.log(`   統合済み顧客: ${merged.name} (${merged.phone})`);
  console.log(`   ローズカフェ側に残す会員番号: ${roseRoster?.member_number ?? 'なし'}`);
  console.log(`   ICHIGUN用に新規作成する顧客の会員番号: ${ichiRoster.member_number}`);
  console.log(`   付け替えるICHIGUN予約: ${ichiRes.rows.length}件 ${ichiRes.rows.map((r: any) => r.id).join(', ')}`);

  if (DRY_RUN) {
    console.log('\n（DRY_RUN のため何も変更していません）');
    await client.end();
    return;
  }

  await client.query('BEGIN');
  try {
    // 1. ICHIGUN用の新規顧客を作る
    const newCust = await client.query(`
      INSERT INTO customers (name, phone, shop_id, owner_id, member_number, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [merged.name, merged.phone, ichi.id, merged.owner_id, ichiRoster.member_number, merged.status]);
    const newCustId = newCust.rows[0].id;
    console.log(`\n   新規顧客を作成: ${newCustId}`);

    // 2. 在籍行を新規顧客側に作る
    await client.query(`
      INSERT INTO customer_shops (customer_id, shop_id, member_number)
      VALUES ($1, $2, $3)
    `, [newCustId, ichi.id, ichiRoster.member_number]);

    // 3. ICHIGUN側の予約を付け替え
    const upd = await client.query(`UPDATE reservations SET customer_id = $1 WHERE customer_id = $2 AND shop_id = $3`, [newCustId, MERGED_CUSTOMER_ID, ichi.id]);
    console.log(`   予約を付け替え: ${upd.rowCount}件`);

    // 4. 統合済み顧客からICHIGUNの在籍行を削除
    await client.query(`DELETE FROM customer_shops WHERE customer_id = $1 AND shop_id = $2`, [MERGED_CUSTOMER_ID, ichi.id]);

    // 5. 統合済み顧客の member_number（単一列）をローズカフェの番号に戻す
    await client.query(`UPDATE customers SET member_number = $1 WHERE id = $2`, [roseRoster?.member_number ?? null, MERGED_CUSTOMER_ID]);

    await client.query('COMMIT');
    console.log('\n   ✓ 分け戻し完了');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('   ★失敗（ロールバック済み）:', (err as Error).message);
    throw err;
  }

  await client.end();
}

main().catch(e => {
  console.error('失敗:', e);
  process.exitCode = 1;
});
