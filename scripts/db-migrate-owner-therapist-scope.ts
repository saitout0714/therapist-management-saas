/**
 * owners にセラピストの扱いを示す therapist_scope を追加する。
 *
 *   all_shops … 全員がどの店舗にも出勤しうる。在籍の指定も店舗別の源氏名も不要（バカラ）
 *   per_shop  … 在籍する店舗を指定する。源氏名やプロフィールも店舗ごとに持つ（既定）
 *
 * 料金・バックの共有設定と同じく、グループ単位の選択制にする。
 * 外部キーは張らない。owners → shops の参照を作ると shops に owners を埋め込む
 * クエリがPostgRESTで曖昧になり、管理画面が停止するため（2026-08-11に経験済み）。
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
        ADD COLUMN IF NOT EXISTS therapist_scope text NOT NULL DEFAULT 'per_shop';
    `);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'owners_therapist_scope_check') THEN
          ALTER TABLE owners ADD CONSTRAINT owners_therapist_scope_check
            CHECK (therapist_scope IN ('all_shops','per_shop'));
        END IF;
      END $$;
    `);
    console.log(`${label}: 列と制約を用意しました`);

    // バカラは全店舗に全員が出勤しうる運用（オーナー確認済み）
    const r = await client.query(`
      UPDATE owners SET therapist_scope = 'all_shops'
       WHERE name = 'バカラグループ'
      RETURNING name;
    `);
    console.log(`${label}: all_shops に設定 = ${r.rowCount}件 ${r.rows.map(x => x.name).join(', ')}`);

    await client.query('COMMIT');

    const check = await client.query(`
      SELECT o.name, o.therapist_scope,
             (SELECT count(*) FROM shops s WHERE s.owner_id = o.id) AS shop_count
        FROM owners o
       WHERE (SELECT count(*) FROM shops s WHERE s.owner_id = o.id) > 1
       ORDER BY o.name;
    `);
    console.log(`\n${label}: 複数店舗グループの設定`);
    check.rows.forEach((x: any) =>
      console.log(`   ${String(x.name).padEnd(24)} ${x.therapist_scope}  (${x.shop_count}店舗)`)
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`${label}: Error:`, err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

migrate('PRODUCTION', process.env.PRODUCTION_DATABASE_URL);
