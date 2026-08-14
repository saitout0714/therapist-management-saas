/**
 * therapist_shops に読み取りポリシーを追加する。
 *
 * RLSが有効なのにポリシーが1つも無く、サービスロール以外は誰も読めなかった。
 * そのため店舗別源氏名は画面に一度も反映されておらず、Phase 2 で一覧を
 * 在籍基準に切り替えると全店舗0名になってしまう。
 *
 * 追加するのは SELECT のみ。書き込みは引き続きサーバー側に限定する。
 * 対象ロールは shops / owners の既存ポリシーに合わせる。
 * 保持しているのは在籍と源氏名のみで、資格情報は含まない。
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

    const before = await client.query(
      `select policyname from pg_policies where tablename = 'therapist_shops'`
    );
    console.log(`${label}: 変更前のポリシー = ${before.rows.map(r => r.policyname).join(', ') || 'なし'}`);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
           WHERE tablename = 'therapist_shops' AND policyname = 'Therapist Shops Select Policy'
        ) THEN
          CREATE POLICY "Therapist Shops Select Policy" ON therapist_shops
            FOR SELECT TO public USING (true);
        END IF;
      END $$;
    `);

    const after = await client.query(
      `select policyname, cmd, roles::text as roles from pg_policies where tablename = 'therapist_shops'`
    );
    console.log(`${label}: 変更後のポリシー`);
    after.rows.forEach(r => console.log(`   ${r.policyname}  cmd=${r.cmd} roles=${r.roles}`));
  } catch (err) {
    console.error(`${label}: Error:`, err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

migrate('PRODUCTION', process.env.PRODUCTION_DATABASE_URL);
