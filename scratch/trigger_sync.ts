import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const connectionString = process.env.PRODUCTION_DATABASE_URL;
  if (!connectionString) return;
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query(`
      UPDATE shops SET needs_sync = true WHERE name LIKE '%こころリンス%';
    `);
    console.log('Set needs_sync to true for Cocoro Rinse');
  } finally {
    await client.end();
  }
}
main();
