/**
 * 顧客を「共通の人」と「店舗ごとの会員番号」に分けるための土台を作る。
 *
 * セラピストの therapist_shops と同じ考え方。
 *   - customers          … 人そのもの（電話番号・メモ・出禁状況など店舗をまたいで共通の情報）
 *   - customer_shops     … 店舗ごとの会員番号（ローズカフェでは80082番、ICHIGUNでは50002番、など）
 *
 * 列・テーブルを追加するだけで、既存の画面の動きは何も変わらない。
 * 値の移行（既存の customers.member_number を customer_shops へ複製する）は別スクリプトで行う。
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
        ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES owners(id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_shops (
        customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        shop_id     uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        member_number text,
        created_at  timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (customer_id, shop_id)
      );
    `);

    await client.query('COMMIT');
    console.log(`${label}: owner_id 列・customer_shops テーブルを用意しました`);

    const check = await client.query(`
      SELECT
        (SELECT count(*) FROM information_schema.columns WHERE table_name='customers' AND column_name='owner_id')::int AS owner_col,
        (SELECT to_regclass('public.customer_shops') IS NOT NULL)::int AS has_table;
    `);
    console.log(`${label}: 確認 = owner_id列 ${check.rows[0].owner_col ? 'あり' : '★なし'} / customer_shopsテーブル ${check.rows[0].has_table ? 'あり' : '★なし'}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`${label}: Error:`, err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

migrate('PRODUCTION', process.env.PRODUCTION_DATABASE_URL);
