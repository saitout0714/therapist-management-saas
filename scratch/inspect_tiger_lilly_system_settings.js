const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const prodUrl = process.env.PRODUCTION_DATABASE_URL;
  if (!prodUrl) return;

  const client = new Client({ connectionString: prodUrl });
  await client.connect();

  try {
    const shopId = '4808aee9-9940-410c-aa5b-dd1364e2da2c';
    const res = await client.query('SELECT * FROM system_settings WHERE shop_id = $1', [shopId]);
    console.log("=== TIGER LILLY SYSTEM SETTINGS ===");
    console.log(res.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
