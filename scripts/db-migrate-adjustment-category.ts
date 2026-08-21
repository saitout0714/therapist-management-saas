/**
 * 控除・ペナルティ・手当・待機保証を、1つの仕組みに統合する。
 *
 * 【経緯】
 * 待機保証だけを別テーブル(standby_guarantees)で作ったが、実際に運用しているお店を見ると
 * 「控除・手当・ペナルティが毎日決まって発生する」店舗はほぼ無く、当欠・釣銭不足・
 * 不足分の補填のようなイレギュラーな単発調整が大半だった。
 *
 * そして、そのイレギュラーな調整は既に therapist_memos（引き継ぎメモ、amount列あり）で
 * シフト画面・セラピスト編集画面・メモ一覧・日次精算画面から日常的に使われている
 * （本番で112件、うち109件が金額入り）。待機保証専用の別テーブルを増やすより、
 * この既存の仕組みに「区分」を足して一本化したほうが、他の画面（シフト表・メモ一覧・精算）
 * からも同じ調整が見え、待機保証もその他の控除・手当と同列に扱える。
 *
 * standby_guarantees テーブル（このセッションで作ったばかりで本番0件）は用済みのため削除する。
 * standby_guarantee_tiers（時間帯別の推奨金額）と system_settings.standby_guarantee_amount
 * （定額の初期値）はそのまま残す。「金額の初期値を計算する」役割は変わらないため。
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
      ALTER TABLE public.therapist_memos
        ADD COLUMN IF NOT EXISTS category text;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'therapist_memos_category_valid'
        ) THEN
          ALTER TABLE public.therapist_memos
            ADD CONSTRAINT therapist_memos_category_valid
            CHECK (category IS NULL OR category IN ('deduction', 'penalty', 'allowance', 'standby_guarantee'));
        END IF;
      END $$;
    `);

    // 集計レポートが期間で引きやすいように、日付での検索用の索引を張る
    await client.query(`
      CREATE INDEX IF NOT EXISTS therapist_memos_shop_date_idx
        ON public.therapist_memos (shop_id, date);
    `);

    // standby_guarantees は今回で用済み（本番0件・未リリース）。実績は今後すべて
    // therapist_memos (category='standby_guarantee') に記録する。
    await client.query(`DROP TABLE IF EXISTS public.standby_guarantees;`);

    await client.query('COMMIT');

    const cols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'therapist_memos' ORDER BY ordinal_position;
    `);
    const dropped = await client.query(`SELECT to_regclass('public.standby_guarantees') AS tbl`);

    console.log(`${label}: therapist_memos = ${cols.rows.map((r) => r.column_name).join(', ')}`);
    console.log(`${label}: standby_guarantees = ${dropped.rows[0].tbl ?? '削除済み'}`);
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
