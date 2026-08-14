/**
 * Phase 2 ステップ3：重複8組を1レコードに統合する。
 *
 * 対象は「同一人物なのに店舗ごとに別レコードになっている」8組。
 * うち7組は仕様書記載の重複（アーバンスパ⇄新宿秘密妻5組、ローズカフェ⇄ICHIGUN2組）。
 * 「カホ（新宿秘密妻）⇄かほ（アーバンスパ）」は仕様書作成後の8/13に新規登録・
 * リンクされていた8組目で、2026-08-14にオーナー確認のうえ同一人物と判定し追加。
 *
 * 各組で「残す側（主）」は、予約・シフト等の関連データが多い側を選ぶ
 * （付け替えるFKの件数を最小化するため。プロフィールの見え方には影響しない）。
 *
 * 統合の流れ（1組ごとにトランザクション）:
 *   1. 消える側（副）の現在のプロフィール・ランク・源氏名を therapist_shops へ退避
 *      （主側の店舗の在籍行にも、主側自身の現在値を明示的に複製する。
 *       null依存の共通値フォールバックに頼らず、両店とも独立して正しい値を持たせる）
 *   2. 予約・シフト・精算実績・NGリスト等、therapist_id を持つ全テーブルを
 *      副→主に付け替え
 *   3. 副の therapists 行を削除（在籍行は ON DELETE CASCADE で自動的に消える）
 *   4. 主の linked_therapist_group_id をクリア（統合後はリンクという概念自体が不要）
 *
 * shop_links テーブルは変更しない。ルーム同士のリンク機能とも共用されているため、
 * セラピスト用の使い方をやめるだけで、テーブル自体・他店リンクの登録内容は触らない。
 *
 * 事前確認（2026-08-14, scratch/investigate_merge_full.ts, scratch/check_merge_conflicts.ts）:
 *   - 8組とも owner_id が両側で一致（オーナー不一致なし）
 *   - 8組とも customer_therapist_ng / therapist_back_overrides / therapist_fee_overrides /
 *     therapist_option_backs / therapist_pricing / shifts のユニーク制約に衝突なし
 *
 * 実行は「まだ削除されていない組だけ処理する」ため再実行可能。
 * DRY_RUN=1 で予定のみ表示（何も変更しない）。
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const DRY_RUN = process.env.DRY_RUN === '1';

// [主側店舗名, 主側名前, 副側店舗名, 副側名前]
const PAIRS: [string, string, string, string][] = [
  ['新宿秘密妻', 'ヒスイ', 'アーバンスパ', 'ひすい'],
  ['新宿秘密妻', 'ハスミ', 'アーバンスパ', 'はすみ'],
  ['新宿秘密妻', 'サトミ', 'アーバンスパ', 'さとみ'],
  ['アーバンスパ', 'あいら', '新宿秘密妻', 'アイラ'],
  ['新宿秘密妻', 'マヤ', 'アーバンスパ', 'まや'],
  ['ローズカフェ', '美波', 'ICHIGUN', '立花 ひかり'],
  ['ローズカフェ', '春井', 'ICHIGUN', '山下 りこ'],
  ['新宿秘密妻', 'カホ', 'アーバンスパ', 'かほ'],
];

// therapist_id を持ち、FKの削除時挙動が ON DELETE SET NULL のテーブル
// （何もしないと副を削除した瞬間に therapist_id が NULL化されてしまう）
const SET_NULL_TABLES = ['reservations', 'shifts', 'sync_jobs'];

// therapist_id を持ち、ON DELETE CASCADE のテーブル
// （何もしないと副を削除した瞬間にレコードごと消えてしまう）
const CASCADE_TABLES = [
  'customer_therapist_ng',
  'payroll_entries',
  'therapist_back_overrides',
  'therapist_blogs',
  'therapist_fee_overrides',
  'therapist_memos',
  'therapist_option_backs',
  'therapist_pricing',
];

const PROFILE_COLS = ['age', 'height', 'bust', 'bust_cup', 'waist', 'hip', 'comment', 'x_url', 'rank_id'] as const;

async function main() {
  const client = new Client({ connectionString: process.env.PRODUCTION_DATABASE_URL });
  await client.connect();

  const shops = await client.query(`SELECT id, name FROM shops`);
  const shopByName = new Map(shops.rows.map(s => [s.name, s]));

  let processed = 0;
  let alreadyDone = 0;

  for (const [primaryShopName, primaryName, secondaryShopName, secondaryName] of PAIRS) {
    const primaryShop = shopByName.get(primaryShopName);
    const secondaryShop = shopByName.get(secondaryShopName);
    if (!primaryShop || !secondaryShop) {
      console.log(`★ 店舗が見つかりません: ${primaryShopName} / ${secondaryShopName}`);
      continue;
    }

    const tRes = await client.query(
      `SELECT * FROM therapists WHERE (shop_id = $1 AND name = $2) OR (shop_id = $3 AND name = $4)`,
      [primaryShop.id, primaryName, secondaryShop.id, secondaryName]
    );
    const primary = tRes.rows.find(t => t.shop_id === primaryShop.id && t.name === primaryName);
    const secondary = tRes.rows.find(t => t.shop_id === secondaryShop.id && t.name === secondaryName);

    console.log(`─── ${primaryName}（${primaryShopName}・主） ↔ ${secondaryName}（${secondaryShopName}・副） ───`);

    if (!primary && !secondary) {
      console.log('   両方見つかりません（スキップ）\n');
      continue;
    }
    if (!secondary) {
      console.log('   副側が既に存在しません＝統合済みとみなしてスキップ\n');
      alreadyDone++;
      continue;
    }
    if (!primary) {
      console.log('   ★主側が見つかりません（要調査、スキップ）\n');
      continue;
    }

    // --- 件数を集計して表示 ---
    const counts: Record<string, number> = {};
    for (const table of [...SET_NULL_TABLES, ...CASCADE_TABLES, 'therapist_photos']) {
      const r = await client.query(`SELECT count(*)::int AS n FROM ${table} WHERE therapist_id = $1`, [secondary.id]);
      counts[table] = r.rows[0].n;
    }
    const nonZero = Object.entries(counts).filter(([, n]) => n > 0);
    console.log(`   付け替え件数: ${nonZero.length ? nonZero.map(([t, n]) => `${t}=${n}`).join(', ') : 'なし'}`);
    console.log(`   退避するプロフィール（副=${secondaryName}）: age=${secondary.age ?? '-'} height=${secondary.height ?? '-'} bust=${secondary.bust ?? '-'}/${secondary.bust_cup ?? '-'} rank_id=${secondary.rank_id ?? '-'}`);

    if (DRY_RUN) {
      console.log('   （DRY_RUN のため何も変更していません）\n');
      processed++;
      continue;
    }

    await client.query('BEGIN');
    try {
      // 1. 副の在籍行を作り直す（主IDで、副店舗の在籍として。プロフィールは副の値をそのまま退避）
      const profileValsSecondary = PROFILE_COLS.map(c => secondary[c] ?? null);
      await client.query(
        `INSERT INTO therapist_shops (therapist_id, shop_id, alias_name, is_active, age, height, bust, bust_cup, waist, hip, comment, x_url, rank_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (therapist_id, shop_id) DO UPDATE SET
           alias_name = EXCLUDED.alias_name, is_active = EXCLUDED.is_active,
           age = EXCLUDED.age, height = EXCLUDED.height, bust = EXCLUDED.bust, bust_cup = EXCLUDED.bust_cup,
           waist = EXCLUDED.waist, hip = EXCLUDED.hip, comment = EXCLUDED.comment, x_url = EXCLUDED.x_url, rank_id = EXCLUDED.rank_id`,
        [primary.id, secondary.shop_id, secondaryName, secondary.is_active, ...profileValsSecondary]
      );

      // 2. 主の在籍行にも、主自身の現在値を明示的に複製する（null依存フォールバックをやめて両店とも独立させる）
      const profileValsPrimary = PROFILE_COLS.map(c => primary[c] ?? null);
      await client.query(
        `INSERT INTO therapist_shops (therapist_id, shop_id, alias_name, is_active, age, height, bust, bust_cup, waist, hip, comment, x_url, rank_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (therapist_id, shop_id) DO UPDATE SET
           age = EXCLUDED.age, height = EXCLUDED.height, bust = EXCLUDED.bust, bust_cup = EXCLUDED.bust_cup,
           waist = EXCLUDED.waist, hip = EXCLUDED.hip, comment = EXCLUDED.comment, x_url = EXCLUDED.x_url, rank_id = EXCLUDED.rank_id`,
        [primary.id, primary.shop_id, null, primary.is_active, ...profileValsPrimary]
      );

      // 3. therapist_photos は shop_id 付きなので therapist_id の付け替えだけでよい
      await client.query(`UPDATE therapist_photos SET therapist_id = $1 WHERE therapist_id = $2`, [primary.id, secondary.id]);

      // 4. SET NULL テーブル・CASCADE テーブルを付け替え
      for (const table of [...SET_NULL_TABLES, ...CASCADE_TABLES]) {
        await client.query(`UPDATE ${table} SET therapist_id = $1 WHERE therapist_id = $2`, [primary.id, secondary.id]);
      }

      // 5. 副の therapists 行を削除（在籍行(旧)は CASCADE で自動削除される）
      await client.query(`DELETE FROM therapists WHERE id = $1`, [secondary.id]);

      // 6. 主のリンクIDをクリア（統合済みなので不要）
      await client.query(`UPDATE therapists SET linked_therapist_group_id = NULL WHERE id = $1`, [primary.id]);

      await client.query('COMMIT');
      console.log('   ✓ 統合完了\n');
      processed++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`   ★失敗（ロールバック済み）:`, (err as Error).message);
      throw err;
    }
  }

  console.log(`■ 集計\n   処理: ${processed}組 / 既に統合済み: ${alreadyDone}組 / 対象: ${PAIRS.length}組`);

  if (!DRY_RUN && processed > 0) {
    // --- 確認 ---
    const check = await client.query(`SELECT count(*)::int AS n FROM therapists WHERE linked_therapist_group_id IS NOT NULL`);
    console.log(`\n■ 変更後\n   linked_therapist_group_id が残っているセラピスト: ${check.rows[0].n}名（0が正常）`);
  }

  await client.end();
}

main().catch(e => {
  console.error('失敗:', e);
  process.exitCode = 1;
});
