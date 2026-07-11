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
    
    console.log('Adding signature_status and signed_at columns...');
    await client.query(`
      ALTER TABLE "public"."customers" 
        ADD COLUMN IF NOT EXISTS "signature_status" text NOT NULL DEFAULT '未署名'::text,
        ADD COLUMN IF NOT EXISTS "signed_at" timestamp with time zone;
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
