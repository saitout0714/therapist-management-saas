require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const connectionString = "postgresql://postgres:Al2021al0518@db.pumkniqtgjsotsxhyvbq.supabase.co:6543/postgres";

async function run() {
  // 1. Inspect shop_owners constraints
  const client = new Client({ connectionString });
  await client.connect();
  try {
    console.log("=== CHECK CONSTRAINTS ON 'shop_owners' ===");
    const constraintsRes = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) 
      FROM pg_constraint c 
      JOIN pg_class t ON t.oid = c.conrelid 
      WHERE t.relname = 'shop_owners';
    `);
    console.log(constraintsRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }

  // 2. Try simulating the full flow
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get a valid shop_id
  const { data: shops } = await supabase.from('shops').select('id').limit(1);
  if (!shops || shops.length === 0) {
    console.error("No shops found in DB, cannot run full test.");
    return;
  }
  const shopId = shops[0].id;
  console.log(`Using shopId: ${shopId} for testing`);

  async function testFullFlow(role) {
    const loginId = `test_flow_${role}_${Date.now()}`;
    const email = `${loginId}@yoyakl.tokyo`;
    const password = "password1234";
    const name = `Test Flow ${role}`;

    console.log(`\n=== TESTING FULL FLOW FOR ROLE: ${role} ===`);
    let authUserId = null;
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role },
      });

      if (authError) {
        console.error("Auth Error:", authError);
        return;
      }

      authUserId = authData.user.id;
      console.log("Auth user created:", authUserId);

      // Verify db user synced
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .single();
      
      console.log("DB User Synced:", dbUser, "DB Error:", dbError);

      // Try inserting into shop_owners
      console.log("Inserting into shop_owners...");
      const { data: ownerData, error: ownerError } = await supabase
        .from('shop_owners')
        .insert([{
          shop_id: shopId,
          user_id: authUserId
        }]);

      if (ownerError) {
        console.error("Shop Owners Insert Error:", ownerError);
      } else {
        console.log("Shop Owners Insert Success!");
      }

    } catch (err) {
      console.error("Exception:", err);
    } finally {
      if (authUserId) {
        console.log("Cleaning up user...");
        // Cleanup shop_owners (if not cascaded or just to be safe)
        await supabase.from('shop_owners').delete().eq('user_id', authUserId);
        await supabase.auth.admin.deleteUser(authUserId);
        console.log("Cleanup done.");
      }
    }
  }

  await testFullFlow('agency_client_owner');
  await testFullFlow('simple_client_owner');
}

run();
