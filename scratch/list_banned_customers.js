const { Client } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const dbUrl = process.env.PRODUCTION_DATABASE_URL;

async function run() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const res = await client.query("SELECT id, shop_id, name, phone, status, memo FROM public.customers WHERE status = '出禁'");
    console.log(`Found ${res.rows.length} banned customers globally:`);
    for (const row of res.rows) {
      console.log(`- Shop: ${row.shop_id} | Name: "${row.name}" | Phone: "${row.phone}" | Memo: "${row.memo}"`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
