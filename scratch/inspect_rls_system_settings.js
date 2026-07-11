const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const prodUrl = process.env.PRODUCTION_DATABASE_URL;
  if (!prodUrl) return;

  const client = new Client({ connectionString: prodUrl });
  await client.connect();

  try {
    // Check if RLS is enabled on system_settings
    const rlsRes = await client.query(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname = 'system_settings'
    `);
    console.log("=== RLS STATUS ON system_settings ===");
    console.log(rlsRes.rows);

    // Check policies on system_settings
    const policiesRes = await client.query(`
      SELECT * 
      FROM pg_policies 
      WHERE tablename = 'system_settings'
    `);
    console.log("\n=== POLICIES ON system_settings ===");
    console.log(policiesRes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
