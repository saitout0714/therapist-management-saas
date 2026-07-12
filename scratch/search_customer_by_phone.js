const { Client } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const dbUrl = process.env.PRODUCTION_DATABASE_URL;

async function run() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const res1 = await client.query("SELECT id, shop_id, name, phone FROM public.customers WHERE name LIKE '%3458%' OR name LIKE '%5876%'");
    console.log('Results:', res1.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
