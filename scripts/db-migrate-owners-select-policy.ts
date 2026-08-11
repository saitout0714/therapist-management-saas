/**
 * owners テーブルに読み取りポリシーを追加する。
 *
 * owners はRLSが有効なのにポリシーが1つも無く、サービスロール以外は誰も読めなかった。
 * そのため画面側でグループの共有設定（pricing_mode / back_mode）が取得できず、
 * ShopContext は常に旧方式（shops.*_source_shop_id）へフォールバックしていた。
 *
 * 追加するのは SELECT のみ。書き込みは引き続きサーバー側（サービスロール）に限定する。
 * 対象ロールは shops テーブルの既存ポリシーに合わせる（anon でも読める）。
 * セッション切れ時に anon へ落ちても表示が壊れないようにするため。
 *
 * owners が持つのはグループ名・コード・プラン種別・共有設定のみで、資格情報は含まない。
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
      `select policyname from pg_policies where tablename = 'owners'`
    );
    console.log(`${label}: 変更前のポリシー = ${before.rows.map(r => r.policyname).join(', ') || 'なし'}`);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
           WHERE tablename = 'owners' AND policyname = 'Owners Select Policy'
        ) THEN
          CREATE POLICY "Owners Select Policy" ON owners
            FOR SELECT TO public USING (true);
        END IF;
      END $$;
    `);

    const after = await client.query(
      `select policyname, cmd, roles::text as roles from pg_policies where tablename = 'owners'`
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
