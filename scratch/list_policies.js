const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function listPolicies(url, dbName) {
  if (!url) return;
  console.log(`\n=== Listing policies on customers table in ${dbName} ===`);
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = 'customers'
    `);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

async function main() {
  await listPolicies(process.env.DEVELOPMENT_DATABASE_URL, "DEVELOPMENT");
  await listPolicies(process.env.PRODUCTION_DATABASE_URL, "PRODUCTION");
}

main();
