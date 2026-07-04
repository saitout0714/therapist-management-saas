const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function inspectFunc(url, dbName) {
  if (!url) return;
  console.log(`\n=== Inspecting check_shop_access in ${dbName} ===`);
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'check_shop_access'
    `);
    if (res.rows.length > 0) {
      console.log(res.rows[0].definition);
    } else {
      console.log("Function 'check_shop_access' not found!");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

async function main() {
  await inspectFunc(process.env.DEVELOPMENT_DATABASE_URL, "DEVELOPMENT");
  await inspectFunc(process.env.PRODUCTION_DATABASE_URL, "PRODUCTION");
}

main();
