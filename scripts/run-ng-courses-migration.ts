import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prodUrl = process.env.PRODUCTION_DATABASE_URL;
const devUrl = process.env.DEVELOPMENT_DATABASE_URL;

async function runMigration(url: string | undefined, name: string) {
  if (!url) {
    console.log(`⚠️ ${name} is not configured.`);
    return;
  }
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    console.log(`🔌 Connected to ${name} database.`);
    
    console.log('Adding ng_course_ids column to therapists table...');
    await client.query(`
      ALTER TABLE therapists ADD COLUMN IF NOT EXISTS ng_course_ids UUID[] DEFAULT '{}';
    `);
    await client.query(`
      UPDATE therapists SET ng_course_ids = '{}' WHERE ng_course_ids IS NULL;
    `);
    console.log(`✅ Migration completed successfully on ${name}!`);
  } catch (err: any) {
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
