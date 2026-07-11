import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local から環境変数を読み込む
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prodUrl = process.env.PRODUCTION_DATABASE_URL;
const devUrl = process.env.DEVELOPMENT_DATABASE_URL;

const sql = `
CREATE INDEX IF NOT EXISTS idx_customers_shop_id_created_at ON public.customers (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reservations_shop_id_created_at ON public.reservations (shop_id, created_at DESC);
`;

async function applySql(dbUrl: string, name: string) {
  console.log(`🔌 Connecting to ${name} Database...`);
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    console.log(`🚀 Applying indexes to ${name}...`);
    await client.query(sql);
    console.log(`✅ Successfully applied indexes to ${name}!`);
  } catch (err: any) {
    console.error(`❌ Failed to apply indexes to ${name}:`, err.message);
  } finally {
    await client.end();
  }
}

async function run() {
  if (!prodUrl && !devUrl) {
    console.error('❌ Error: PRODUCTION_DATABASE_URL or DEVELOPMENT_DATABASE_URL must be defined in .env.local');
    process.exit(1);
  }

  if (prodUrl) {
    await applySql(prodUrl, 'Production');
  } else {
    console.log('⚠️ PRODUCTION_DATABASE_URL is not set. Skipping Production.');
  }

  if (devUrl) {
    await applySql(devUrl, 'Development');
  } else {
    console.log('⚠️ DEVELOPMENT_DATABASE_URL is not set. Skipping Development.');
  }
}

run().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
