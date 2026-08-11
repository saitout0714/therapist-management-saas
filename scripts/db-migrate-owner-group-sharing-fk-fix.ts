/**
 * owners.pricing_base_shop_id / back_base_shop_id の外部キー制約を外す。
 *
 * 外部キーを張ると owners → shops の経路ができ、もともとある shops.owner_id → owners と
 * 合わせて2方向になる。するとPostgRESTが shops から owners を埋め込む際に
 * 「複数のリレーションがある」と判断してクエリ全体が失敗する。
 * ShopContext が `shops` に `owners(...)` を埋め込んでいるため、管理画面全体が停止した。
 *
 * 列そのもの（uuid）は残す。参照整合性より、既存の埋め込みクエリが壊れないことを優先する。
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

    const before = await client.query(`
      SELECT conname FROM pg_constraint
       WHERE conrelid = 'owners'::regclass AND contype = 'f'
         AND conname LIKE '%base_shop%';
    `);
    console.log(`${label}: 削除対象の外部キー = ${before.rows.map(r => r.conname).join(', ') || 'なし'}`);

    for (const row of before.rows) {
      await client.query(`ALTER TABLE owners DROP CONSTRAINT ${row.conname};`);
    }

    await client.query('COMMIT');
    console.log(`${label}: 外部キーを削除しました（列と値はそのまま）`);

    const check = await client.query(`
      SELECT name, pricing_mode, pricing_base_shop_id, back_mode, back_base_shop_id
        FROM owners WHERE pricing_mode = 'shared' OR back_mode = 'shared';
    `);
    console.log(`${label}: 設定値は保持されているか`);
    check.rows.forEach(r => console.log(`   ${r.name} 料金=${r.pricing_mode} バック=${r.back_mode} 基準店ID=${r.pricing_base_shop_id}`));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`${label}: Error:`, err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

migrate('PRODUCTION', process.env.PRODUCTION_DATABASE_URL);
