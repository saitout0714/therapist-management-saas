/**
 * 待機保証を「待機時間による段階制」にできるようにする。
 *
 * 定額1つ（system_settings.standby_guarantee_amount）では
 * 「4時間未満は1,000円、6時間以上は2,000円」のような店舗ルールを表せないため、
 * 「◯時間以上 → ◯円」の段階を店舗ごとに並べて持つテーブルを足す。
 *
 * 段階を1つも登録していない店舗は、これまで通り定額の既定額が使われる。
 * db-migrate-standby-guarantee.ts を先に実行しておくこと。
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
      CREATE TABLE IF NOT EXISTS public.standby_guarantee_tiers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
        min_hours numeric(4,1) NOT NULL,
        amount integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // 同じ店舗に「6時間以上」を2つ作れてしまうと、どちらが効くのか決まらなくなる
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'standby_guarantee_tiers_shop_min_hours_key'
        ) THEN
          ALTER TABLE public.standby_guarantee_tiers
            ADD CONSTRAINT standby_guarantee_tiers_shop_min_hours_key
            UNIQUE (shop_id, min_hours);
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'standby_guarantee_tiers_values_valid'
        ) THEN
          ALTER TABLE public.standby_guarantee_tiers
            ADD CONSTRAINT standby_guarantee_tiers_values_valid
            CHECK (min_hours >= 0 AND amount >= 0);
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS standby_guarantee_tiers_shop_idx
        ON public.standby_guarantee_tiers (shop_id, min_hours);
    `);

    await client.query(`ALTER TABLE public.standby_guarantee_tiers ENABLE ROW LEVEL SECURITY;`);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'standby_guarantee_tiers'
            AND policyname = 'Standby Guarantee Tiers Shop Owner Policy'
        ) THEN
          CREATE POLICY "Standby Guarantee Tiers Shop Owner Policy"
            ON public.standby_guarantee_tiers
            FOR ALL
            USING (check_shop_access(shop_id))
            WITH CHECK (check_shop_access(shop_id));
        END IF;
      END $$;
    `);

    await client.query('COMMIT');

    const cols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'standby_guarantee_tiers' ORDER BY ordinal_position;
    `);
    const pol = await client.query(`
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'standby_guarantee_tiers';
    `);

    console.log(`${label}: standby_guarantee_tiers = ${cols.rows.map((r) => r.column_name).join(', ') || '★作成されていません'}`);
    console.log(`${label}: RLSポリシー = ${pol.rows.map((r) => r.policyname).join(', ') || '★なし'}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`${label}: Error:`, err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

async function main() {
  // アプリが実際に読むのは PRODUCTION 側。DEVELOPMENT だけ流しても画面には反映されない。
  await migrate('PRODUCTION', process.env.PRODUCTION_DATABASE_URL);
  await migrate('DEVELOPMENT', process.env.DEVELOPMENT_DATABASE_URL);
}

main();
