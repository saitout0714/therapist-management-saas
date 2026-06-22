import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DEVELOPMENT_DATABASE_URL;
const DRY_RUN = process.env.DRY_RUN !== 'false';

if (!dbUrl) {
  console.error('❌ Error: PRODUCTION_DATABASE_URL or DEVELOPMENT_DATABASE_URL must be defined.');
  process.exit(1);
}

// 変更対象の顧客を抽出するクエリ
const selectSql = `
SELECT 
  c.id, 
  c.name, 
  c.created_at as current_created_at, 
  (
    SELECT MIN(r.date)
    FROM public.reservations r
    WHERE r.customer_id = c.id
      AND r.status NOT IN ('cancelled', 'blocked')
  ) as oldest_reservation_date,
  s.name as shop_name
FROM public.customers c
LEFT JOIN public.shops s ON c.shop_id = s.id
WHERE EXISTS (
  SELECT 1
  FROM public.reservations r
  WHERE r.customer_id = c.id
    AND r.status NOT IN ('cancelled', 'blocked')
)
AND c.created_at::date != (
  SELECT MIN(r.date)
  FROM public.reservations r
  WHERE r.customer_id = c.id
    AND r.status NOT IN ('cancelled', 'blocked')
)
ORDER BY s.name, c.name;
`;

// 一括アップデートするクエリ
const updateSql = `
UPDATE public.customers c
SET created_at = (
  SELECT MIN(r.date)::timestamp with time zone
  FROM public.reservations r
  WHERE r.customer_id = c.id
    AND r.status NOT IN ('cancelled', 'blocked')
)
WHERE EXISTS (
  SELECT 1
  FROM public.reservations r
  WHERE r.customer_id = c.id
    AND r.status NOT IN ('cancelled', 'blocked')
)
AND c.created_at::date != (
  SELECT MIN(r.date)
  FROM public.reservations r
  WHERE r.customer_id = c.id
    AND r.status NOT IN ('cancelled', 'blocked')
);
`;

async function run() {
  console.log(`🚀 Starting Customer created_at Correction Patch`);
  console.log(`MODE: ${DRY_RUN ? '🔍 DRY RUN (Simulating changes)' : '💾 LIVE RUN (Database will be updated)'}`);
  console.log(`Database: ${dbUrl.split('@')[1] || 'URL'}`);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // 1. 変更対象の顧客をチェック
    console.log('📡 Fetching target customers with mismatched registration dates...');
    const selectRes = await client.query(selectSql);
    const targets = selectRes.rows;

    console.log(`Found ${targets.length} customers with mismatched created_at dates.`);

    // ログに出力
    targets.forEach((row, index) => {
      const current = new Date(row.current_created_at).toISOString().split('T')[0];
      const oldest = new Date(row.oldest_reservation_date).toISOString().split('T')[0];
      console.log(`[${index + 1}] 店: ${row.shop_name} | 顧客: ${row.name} | 現在: ${current} => 修正後: ${oldest}`);
    });

    if (!DRY_RUN && targets.length > 0) {
      console.log('\n💾 Applying updates to the database...');
      const updateRes = await client.query(updateSql);
      console.log(`✅ Successfully updated ${updateRes.rowCount} customers.`);
    }

  } catch (err: any) {
    console.error('❌ Execution failed:', err.message);
  } finally {
    await client.end();
  }

  if (DRY_RUN) {
    console.log('\n💡 This was a DRY RUN. No database records were modified.');
    console.log('   To apply the changes, run: DRY_RUN=false npx tsx scripts/fix-customer-created-at.ts');
  } else {
    console.log('\n🎉 Live run completed and database records have been updated.');
  }
}

run().catch(err => {
  console.error('Unexpected execution error:', err);
  process.exit(1);
});
