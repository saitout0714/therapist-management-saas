const { Client } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const dbUrl = process.env.PRODUCTION_DATABASE_URL;

async function run() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const shopsRes = await client.query('SELECT id, name FROM public.shops');
    console.log('=== SHOPS ===');
    for (const shop of shopsRes.rows) {
      const countRes = await client.query('SELECT count(*) FROM public.customers WHERE shop_id = $1', [shop.id]);
      console.log(`- ID: ${shop.id} | Name: ${shop.name} | Customers: ${countRes.rows[0].count}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
