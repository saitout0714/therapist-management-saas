import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prodUrl = process.env.PRODUCTION_DATABASE_URL;
const devUrl = process.env.DEVELOPMENT_DATABASE_URL;

async function checkCount(url: string | undefined, name: string) {
  if (!url) {
    console.log(`⚠️ ${name} is not configured.`);
    return;
  }
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    const res = await client.query("SELECT COUNT(*) FROM reservations WHERE status NOT IN ('cancelled', 'blocked')");
    console.log(`📊 ${name} reservations count (active): ${res.rows[0].count}`);
  } catch (err: any) {
    console.error(`❌ ${name} error:`, err.message);
  } finally {
    await client.end();
  }
}

async function run() {
  await checkCount(prodUrl, 'Production');
  await checkCount(devUrl, 'Development');
}

run();
