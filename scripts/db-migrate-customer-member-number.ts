/**
 * 顧客の「会員番号」を入れる専用列を用意する。
 *
 * 今は列が無いため、店舗ごとの通し番号（ローズカフェ80000番台、ICHIGUN50000番台など）を
 * スタッフが名前欄に直接書き込んでいる（例:「81678おかもと」）。ローズカフェだけで1,258件。
 *
 * 列を足すだけで、既存の画面の動きは何も変わらない。値はすべて null で入る。
 * 既存データ（名前欄に書かれた番号）をこの列へ移す作業は別途行う。
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrate(label: string, dbUrl: string | undefined) {
  if (!dbUrl) {
    console.log(`${label}: URL not found, skipping.`);
    return;
  }
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS member_number text;
    `);

    await client.query('COMMIT');
    console.log(`${label}: member_number 列を用意しました`);

    const check = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'customers' AND column_name = 'member_number';
    `);
    console.log(`${label}: 確認 = ${check.rows.length ? 'あり' : '★列が見つかりません'}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`${label}: Error:`, err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

migrate('PRODUCTION', process.env.PRODUCTION_DATABASE_URL);
