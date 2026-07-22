import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const connectionString = process.env.PRODUCTION_DATABASE_URL;
  if (!connectionString) return;
  const client = new Client({ connectionString });
  await client.connect();

  const res = await client.query(`
    SELECT id, name, estama_login_id, estama_password, estama_shop_url
    FROM shops
    WHERE id = 'dc3caa06-fcc2-4bdc-b063-7969296efd34';
  `);
  console.log('Shop details:', res.rows[0]);
  await client.end();
}

main();
