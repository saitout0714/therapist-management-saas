const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function testAnon(url, dbName) {
  if (!url) return;
  console.log(`\n=== Testing Anon Insert in ${dbName} ===`);
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query("BEGIN");
    
    // Set role to anon to simulate Supabase unauthenticated request
    await client.query("SET LOCAL ROLE anon");
    // Verify auth.uid() is null
    const uidRes = await client.query("SELECT auth.uid() AS current_uid");
    console.log("auth.uid() returned:", uidRes.rows[0].current_uid);

    const targetShopId = 'dc3caa06-fcc2-4bdc-b063-7969296efd34'; // こころリンス浅草橋
    const insertRes = await client.query(`
      INSERT INTO public.customers (name, shop_id)
      VALUES ('Test Anon Customer', $1)
      RETURNING *
    `, [targetShopId]).catch(e => ({ error: e.message }));
    
    if (insertRes.error) {
      console.log("INSERT FAILED with error:", insertRes.error);
    } else {
      console.log("INSERT SUCCESS:", insertRes.rows);
    }

    await client.query("ROLLBACK");
  } catch (err) {
    console.error("Transaction failed:", err);
    await client.query("ROLLBACK").catch(() => {});
  } finally {
    await client.end();
  }
}

async function main() {
  await testAnon(process.env.DEVELOPMENT_DATABASE_URL, "DEVELOPMENT");
  await testAnon(process.env.PRODUCTION_DATABASE_URL, "PRODUCTION");
}

main();
