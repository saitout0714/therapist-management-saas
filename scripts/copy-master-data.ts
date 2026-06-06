import { Client } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const sourceUrl = process.env.PRODUCTION_DATABASE_URL;
const targetUrl = process.env.DEVELOPMENT_DATABASE_URL;

const tablesToCopy = [
  'shops',
  'rooms',
  'therapist_ranks',
  'therapists',
  'courses',
  'options',
  'therapist_pricing',
  'nomination_fees',
  'system_settings',
  'shop_back_rules',
  'course_back_amounts',
  'rank_back_rules',
  'therapist_option_backs'
];

async function run() {
  if (!sourceUrl || !targetUrl) {
    console.error('❌ Error: PRODUCTION_DATABASE_URL and DEVELOPMENT_DATABASE_URL must be defined in .env.local');
    process.exit(1);
  }

  const sourceClient = new Client({ connectionString: sourceUrl });
  const targetClient = new Client({ connectionString: targetUrl });

  try {
    console.log('🔌 Connecting to Source (Production) Database...');
    await sourceClient.connect();
    console.log('🔌 Connecting to Target (Development) Database...');
    await targetClient.connect();
    console.log('✅ Connected to both databases!');

    // 1. Truncate target tables in reverse order to avoid foreign key errors
    console.log('\n🧹 Clearing existing master data in target database...');
    // We temporarily disable triggers/foreign keys or just truncate cascade in reverse order
    await targetClient.query('BEGIN;');
    try {
      // Truncate cascade to clean up all master tables
      const truncateList = [...tablesToCopy, 'shop_owners'].map(t => `"public"."${t}"`).join(', ');
      await targetClient.query(`TRUNCATE TABLE ${truncateList} CASCADE;`);
      await targetClient.query('COMMIT;');
      console.log('  ✅ Target tables cleared successfully.');
    } catch (err: any) {
      await targetClient.query('ROLLBACK;');
      console.error('  ❌ Error clearing target tables:', err.message);
      throw err;
    }

    // 2. Copy each table in correct dependency order
    for (const table of tablesToCopy) {
      console.log(`\n📦 Copying table "${table}"...`);
      const res = await sourceClient.query(`SELECT * FROM "public"."${table}"`);
      
      if (res.rows.length === 0) {
        console.log(`  ℹ️ Table is empty in source, skipping.`);
        continue;
      }

      const columns = Object.keys(res.rows[0]);
      const colsList = columns.map(c => `"${c}"`).join(', ');
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

      await targetClient.query('BEGIN;');
      try {
        let count = 0;
        for (const row of res.rows) {
          const params = columns.map(col => row[col]);
          await targetClient.query(
            `INSERT INTO "public"."${table}" (${colsList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            params
          );
          count++;
        }
        await targetClient.query('COMMIT;');
        console.log(`  ✅ Successfully copied ${count} rows.`);
      } catch (err: any) {
        await targetClient.query('ROLLBACK;');
        console.error(`  ❌ Error copying rows for "${table}":`, err.message);
        throw err;
      }
    }

    // 3. Link admin user to all shops
    console.log('\n🔗 Linking admin user to all shops in shop_owners...');
    const adminRes = await targetClient.query(`SELECT id FROM "public"."users" WHERE login_id = \'admin\' LIMIT 1`);
    if (adminRes.rows.length > 0) {
      const adminId = adminRes.rows[0].id;
      const shopsRes = await targetClient.query(`SELECT id FROM "public"."shops"`);
      
      await targetClient.query('BEGIN;');
      try {
        let linkCount = 0;
        for (const shop of shopsRes.rows) {
          await targetClient.query(
            `INSERT INTO "public"."shop_owners" (shop_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [shop.id, adminId]
          );
          linkCount++;
        }
        await targetClient.query('COMMIT;');
        console.log(`  ✅ Linked admin user to ${linkCount} shops.`);
      } catch (err: any) {
        await targetClient.query('ROLLBACK;');
        console.error('  ❌ Error linking admin user to shops:', err.message);
        throw err;
      }
    } else {
      console.warn('  ⚠️ Admin user not found in public.users, skipped linking.');
    }

    console.log('\n✨ Master data migration completed successfully!');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await sourceClient.end();
    await targetClient.end();
    console.log('🔌 Disconnected from databases.');
  }
}

run();
