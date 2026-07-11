const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function testRls(url, dbName, userId) {
  if (!url) return;
  console.log(`\n=== Testing RLS in ${dbName} for user ${userId} ===`);
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    // 1. Begin transaction to use SET LOCAL
    await client.query("BEGIN");
    
    // Set JWT claims in session context to simulate the user
    // In Supabase, auth.uid() is implemented as:
    // nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    // Or in newer versions, it reads from request.jwt.claims ->> 'sub'
    // Let's set both to be safe.
    await client.query(`SET LOCAL request.jwt.claim.sub = '${userId}'`);
    await client.query(`SET LOCAL "request.jwt.claims" = '{"sub": "${userId}"}'`);

    // Verify auth.uid()
    const uidRes = await client.query("SELECT auth.uid() AS current_uid");
    console.log("auth.uid() returned:", uidRes.rows[0].current_uid);

    // Fetch the user's role from public.users
    const userRes = await client.query("SELECT id, name, role FROM public.users WHERE id = $1", [userId]);
    console.log("User in public.users:", userRes.rows);

    // Let's call check_shop_access
    const targetShopId = 'dc3caa06-fcc2-4bdc-b063-7969296efd34'; // こころリンス浅草橋
    const accessRes = await client.query("SELECT public.check_shop_access($1) AS has_access", [targetShopId]);
    console.log("check_shop_access returned:", accessRes.rows[0].has_access);

    // Let's try to simulate INSERT into customers
    // We will do a rollback so it's not saved
    const insertRes = await client.query(`
      INSERT INTO public.customers (name, shop_id)
      VALUES ('Test Customer from Script', $1)
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
  // Let's run for both DEVELOPMENT and PRODUCTION
  // dev user: 96442dd1-4e6f-487b-8959-4fcd62223b88
  // prod user: d2042d7e-16cc-46fa-a55f-75bb88e051b5
  await testRls(process.env.DEVELOPMENT_DATABASE_URL, "DEVELOPMENT", '96442dd1-4e6f-487b-8959-4fcd62223b88');
  await testRls(process.env.PRODUCTION_DATABASE_URL, "PRODUCTION", 'd2042d7e-16cc-46fa-a55f-75bb88e051b5');
}

main();
