/**
 * 名前欄に直接書かれている会員番号（例:「81678おかもと」）を、
 * 名前と会員番号（customer_shops.member_number）に分離する。
 *
 * 対象はローズカフェ・ICHIGUNのみ（この2店舗だけが「先頭の4〜6桁が会員番号」
 * という運用のため）。他店舗の名前末尾の数字は電話番号の一部などで
 * 意味が異なるため、絶対に対象にしない。
 *
 * 安全のための方針:
 *   - 数字を除いた後に名前が空になる（＝番号だけで名前情報が無い）行は
 *     何もしない。分割すると名前が消えてしまうため、そのまま残して
 *     一覧に出す（人が見て判断する）。
 *   - customers.member_number / customer_shops.member_number に
 *     既に値が入っている行は、その値を上書きしない（誰かが後から
 *     手で直したものかもしれないため）。名前の分割（数字を外す）だけは行う。
 *
 * 実行は「まだ数字が残っている名前だけ」処理するため再実行可能。
 * DRY_RUN=1 で予定のみ表示。
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const DRY_RUN = process.env.DRY_RUN === '1';
const TARGET_SHOP_NAMES = ['ローズカフェ', 'ICHIGUN'];

async function main() {
  const client = new Client({ connectionString: process.env.PRODUCTION_DATABASE_URL });
  await client.connect();

  const shops = await client.query(`SELECT id, name FROM shops WHERE name = ANY($1)`, [TARGET_SHOP_NAMES]);

  let totalSplit = 0;
  let totalSkippedEmpty = 0;

  for (const shop of shops.rows) {
    const res = await client.query(
      `SELECT id, name, member_number FROM customers WHERE shop_id = $1 AND name ~ '^[0-9]{4,6}'`,
      [shop.id]
    );

    console.log(`\n■ ${shop.name}: ${res.rows.length}件を確認`);

    const skippedEmpty: string[] = [];
    let splitCount = 0;

    for (const row of res.rows) {
      const m = row.name.match(/^(\d{4,6})\s*(.*)$/);
      const number = m![1];
      const newName = m![2]?.trim();

      if (!newName) {
        skippedEmpty.push(row.name);
        continue;
      }

      splitCount++;
      if (DRY_RUN) continue;

      await client.query('BEGIN');
      try {
        await client.query('UPDATE customers SET name = $1 WHERE id = $2', [newName, row.id]);
        if (!row.member_number) {
          await client.query('UPDATE customers SET member_number = $1 WHERE id = $2', [number, row.id]);
        }
        await client.query(`
          INSERT INTO customer_shops (customer_id, shop_id, member_number)
          VALUES ($1, $2, $3)
          ON CONFLICT (customer_id, shop_id) DO UPDATE SET member_number = COALESCE(customer_shops.member_number, EXCLUDED.member_number)
        `, [row.id, shop.id, number]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`   ★失敗: "${row.name}" -`, (err as Error).message);
        throw err;
      }
    }

    console.log(`   分割${DRY_RUN ? '予定' : '完了'}: ${splitCount}件`);
    console.log(`   ★名前が空になるためスキップ（要手動確認）: ${skippedEmpty.length}件`);
    if (skippedEmpty.length > 0) skippedEmpty.forEach(n => console.log(`      "${n}"`));

    totalSplit += splitCount;
    totalSkippedEmpty += skippedEmpty.length;
  }

  console.log(`\n■ 合計\n   分割${DRY_RUN ? '予定' : '完了'}: ${totalSplit}件 / 要手動確認: ${totalSkippedEmpty}件`);
  if (DRY_RUN) console.log('\n（DRY_RUN のため何も変更していません）');

  await client.end();
}

main().catch(e => {
  console.error('失敗:', e);
  process.exitCode = 1;
});
