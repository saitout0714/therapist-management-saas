/**
 * オーナーグループごとに「顧客を共有するか、店舗ごとに独立させるか」を選べるようにする。
 *
 * セラピストの owners.therapist_scope と同じ考え方。
 * 既定値は 'shared'（今までの動作を維持）。ローズカフェ・ICHIGUNのオーナーだけ
 * 'per_shop' にする（顧客は共有しない。セラピスト・ルームの共有は今まで通り）。
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
      ALTER TABLE owners
        ADD COLUMN IF NOT EXISTS customer_scope text NOT NULL DEFAULT 'shared';
    `);
    await client.query(`
      ALTER TABLE owners DROP CONSTRAINT IF EXISTS owners_customer_scope_check;
    `);
    await client.query(`
      ALTER TABLE owners
        ADD CONSTRAINT owners_customer_scope_check CHECK (customer_scope IN ('shared', 'per_shop'));
    `);

    // ローズカフェ・ICHIGUNのオーナーだけ per_shop に設定
    const updated = await client.query(`
      UPDATE owners SET customer_scope = 'per_shop'
      WHERE id IN (SELECT DISTINCT owner_id FROM shops WHERE name IN ('ローズカフェ', 'ICHIGUN') AND owner_id IS NOT NULL)
      RETURNING id, name;
    `);

    await client.query('COMMIT');
    console.log(`${label}: customer_scope 列を用意しました`);
    console.log(`${label}: per_shop に設定したオーナー:`, updated.rows);

    const check = await client.query(`SELECT name, customer_scope FROM owners ORDER BY name`);
    console.log(`\n${label}: 全オーナーの設定:`);
    check.rows.forEach((r: any) => console.log(`   ${r.name}: ${r.customer_scope}`));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`${label}: Error:`, err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

migrate('PRODUCTION', process.env.PRODUCTION_DATABASE_URL);
