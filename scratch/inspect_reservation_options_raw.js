const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const prodUrl = process.env.PRODUCTION_DATABASE_URL;
  if (!prodUrl) return;

  const client = new Client({ connectionString: prodUrl });
  await client.connect();

  try {
    const resId = '91f83c06-f24e-4989-bcfd-5207d6eac63d';
    const res = await client.query('SELECT * FROM reservation_options WHERE reservation_id = $1', [resId]);
    console.log("=== RAW RESERVATION OPTIONS ===");
    console.log(res.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
