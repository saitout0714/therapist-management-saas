const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function testRls(url, dbName, userId) {
  if (!url) return;
  console.log(`\n=== Testing Authenticated RLS in ${dbName} for user ${userId} ===`);
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query("BEGIN");
    
    // 1. Set role to authenticated to enforce RLS policies
    await client.query("SET LOCAL ROLE authenticated");

    // 2. Set JWT claims in session context
    await client.query(`SET LOCAL request.jwt.claim.sub = '${userId}'`);
    await client.query(`SET LOCAL "request.jwt.claims" = '{"sub": "${userId}"}'`);

    // Verify auth.uid()
    const uidRes = await client.query("SELECT auth.uid() AS current_uid");
    console.log("auth.uid() returned:", uidRes.rows[0].current_uid);

    // Fetch user role from public.users table (wait, can authenticated select from public.users?)
    const userRes = await client.query("SELECT id, name, role FROM public.users WHERE id = $1", [userId]).catch(e => ({ error: e.message }));
    if (userRes.error) {
      console.log("SELECT from public.users FAILED:", userRes.error);
    } else {
      console.log("User in public.users:", userRes.rows);
    }

    // Call check_shop_access
    const targetShopId = 'dc3caa06-fcc2-4bdc-b063-7969296efd34'; // こころリンス浅草橋
    const accessRes = await client.query("SELECT public.check_shop_access($1) AS has_access", [targetShopId]).catch(e => ({ error: e.message }));
    if (accessRes.error) {
      console.log("check_shop_access FAILED:", accessRes.error);
    } else {
      console.log("check_shop_access returned:", accessRes.rows[0].has_access);
    }

    // Try to insert customer
    const insertRes = await client.query(`
      INSERT INTO public.customers (name, shop_id)
      VALUES ('Test Customer from Auth Script', $1)
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
  // Saitou (system_admin)
  await testRls(process.env.PRODUCTION_DATABASE_URL, "PRODUCTION (Saitou - Admin)", 'd2042d7e-16cc-46fa-a55f-75bb88e051b5');
  
  // Tsujido (agency_client_owner) - does NOT own こころリンス浅草橋
  await testRls(process.env.PRODUCTION_DATABASE_URL, "PRODUCTION (Tsujido - Owner)", '54937a7d-db59-42b8-8b00-d10a63e33542');

  // Kokoro Rinse Asakusabashi (agency_client_owner) - OWNS こころリンス浅草橋
  await testRls(process.env.PRODUCTION_DATABASE_URL, "PRODUCTION (Asakusabashi - Owner)", '191f7821-e15c-4644-96b3-cfc37c2b7e27');
}

main();
