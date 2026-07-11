const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkTherapists(url, dbName) {
  if (!url) return;
  console.log(`\n=== Checking therapists in ${dbName} ===`);
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const res = await client.query("SELECT id, name, shop_id FROM public.therapists WHERE name LIKE '%齋藤%'");
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

async function main() {
  await checkTherapists(process.env.DEVELOPMENT_DATABASE_URL, "DEVELOPMENT");
  await checkTherapists(process.env.PRODUCTION_DATABASE_URL, "PRODUCTION");
}

main();
