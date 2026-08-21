/**
 * 待機保証（予約が1本も入らなかったセラピストに出す保証金）を記録できるようにする。
 *
 * 【なぜ新しいテーブルが要るか】
 * 集計レポートは reservations だけを集計しているため、予約0本のセラピストは
 * 日報にも売上集計にも一切現れない。控除・手当の deduction_rules は
 * 日次精算画面で手動選択するためのマスタで、日付×セラピスト単位の実績を持てず、
 * 集計レポートにも反映されない。よって「誰に・いつ・いくら出したか」を
 * 保存する実績テーブルを別に用意する。
 *
 * standby_guarantees … 1営業日・1セラピストにつき1行（同じ日に二重計上できない）
 * system_settings.standby_guarantee_amount … 店舗ごとの既定額（入力時の初期値）
 *
 * 金額の入力は集計レポートの日報モーダルから行い、
 * 利益 ＝ 売上合計 － 報酬合計 － 待機保証 として集計に反映される。
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
      CREATE TABLE IF NOT EXISTS public.standby_guarantees (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
        therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
        business_date date NOT NULL,
        amount integer NOT NULL DEFAULT 0,
        note text,
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // 同じ営業日に同じセラピストへ二重に保証を出せないようにする。
    // 画面側の upsert もこの制約を競合キーとして使う。
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'standby_guarantees_shop_therapist_date_key'
        ) THEN
          ALTER TABLE public.standby_guarantees
            ADD CONSTRAINT standby_guarantees_shop_therapist_date_key
            UNIQUE (shop_id, therapist_id, business_date);
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'standby_guarantees_amount_non_negative'
        ) THEN
          ALTER TABLE public.standby_guarantees
            ADD CONSTRAINT standby_guarantees_amount_non_negative CHECK (amount >= 0);
        END IF;
      END $$;
    `);

    // 集計レポートは「店舗×期間」で引くので、その形の索引を張る
    await client.query(`
      CREATE INDEX IF NOT EXISTS standby_guarantees_shop_date_idx
        ON public.standby_guarantees (shop_id, business_date);
    `);

    await client.query(`ALTER TABLE public.standby_guarantees ENABLE ROW LEVEL SECURITY;`);

    // shifts / therapist_memos と同じ方針。anon には一切開けない（売上に関わる情報のため）
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'standby_guarantees'
            AND policyname = 'Standby Guarantees Shop Owner Policy'
        ) THEN
          CREATE POLICY "Standby Guarantees Shop Owner Policy"
            ON public.standby_guarantees
            FOR ALL
            USING (check_shop_access(shop_id))
            WITH CHECK (check_shop_access(shop_id));
        END IF;
      END $$;
    `);

    // 店舗ごとの既定額（0 のままなら「既定額なし」＝毎回手入力）
    await client.query(`
      ALTER TABLE public.system_settings
        ADD COLUMN IF NOT EXISTS standby_guarantee_amount integer NOT NULL DEFAULT 0;
    `);

    await client.query('COMMIT');

    const table = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'standby_guarantees' ORDER BY ordinal_position;
    `);
    const col = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'system_settings' AND column_name = 'standby_guarantee_amount';
    `);
    const pol = await client.query(`
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'standby_guarantees';
    `);

    console.log(`${label}: standby_guarantees = ${table.rows.map((r) => r.column_name).join(', ')}`);
    console.log(`${label}: RLSポリシー = ${pol.rows.map((r) => r.policyname).join(', ') || '★なし'}`);
    console.log(`${label}: system_settings.standby_guarantee_amount = ${col.rows.length ? 'あり' : '★列が見つかりません'}`);
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
