const { Client } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const dbUrl = process.env.PRODUCTION_DATABASE_URL;

async function run() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const shops = [
      { id: '7d430288-8aed-4381-b3bf-f35fad962d2f', name: 'アーバンスパ' },
      { id: '774101be-d8c5-4ca5-ba4a-fc61c039fbaa', name: '新宿秘密妻' }
    ];
    for (const shop of shops) {
      console.log(`=== CUSTOMERS OF ${shop.name} ===`);
      const res = await client.query('SELECT id, name, phone, memo FROM public.customers WHERE shop_id = $1 LIMIT 30', [shop.id]);
      for (const row of res.rows) {
        console.log(`- Name: "${row.name}" | Phone: "${row.phone}" | Memo: "${row.memo}"`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
