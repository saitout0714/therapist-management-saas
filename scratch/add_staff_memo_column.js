const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prodUrl = process.env.PRODUCTION_DATABASE_URL;
const devUrl = process.env.DEVELOPMENT_DATABASE_URL;

async function runMigration(url, name) {
  if (!url) {
    console.log(`⚠️ ${name} DB URL is not configured.`);
    return;
  }
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    console.log(`🔌 Connected to ${name} database.`);
    
    console.log('Adding staff_memo column to therapists table...');
    await client.query(`
      ALTER TABLE "public"."therapists" 
        ADD COLUMN IF NOT EXISTS "staff_memo" text;
    `);
    console.log(`✅ Migration completed successfully on ${name}!`);
  } catch (err) {
    console.error(`❌ ${name} migration error:`, err.message);
  } finally {
    await client.end();
  }
}

async function run() {
  await runMigration(devUrl, 'Development');
  await runMigration(prodUrl, 'Production');
}

run();
