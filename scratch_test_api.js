require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCreateUser() {
  const loginId = "test_simple_client_owner_" + Date.now();
  const password = "password123";
  const name = "Test Simple Owner";
  const role = "simple_client_owner";
  // すでに存在する店舗IDを使う
  const shopId = "150ee036-bd95-47ab-bf50-8132d3c62bdf"; // SpecialGradeのID


  console.log(`Starting test with loginId: ${loginId}, role: ${role}`);

  const email = `${loginId}@yoyakl.tokyo`;

  try {
    // 1. Supabase Auth に作成
    console.log("Creating user in Supabase Auth...");
    const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name.trim(), role },
    });

    if (authError) {
      console.error("Auth creation failed:", authError);
      return;
    }

    const newUser = authData.user;
    console.log("Auth user created successfully, ID:", newUser.id);

    // 2. shop_owners に登録
    console.log("Inserting into shop_owners...");
    const { error: ownerError } = await serviceSupabase
      .from('shop_owners')
      .insert([{
        shop_id: shopId,
        user_id: newUser.id
      }]);

    if (ownerError) {
      console.error("Inserting into shop_owners failed:", ownerError);
      // ロールバック
      console.log("Deleting Auth user...");
      await serviceSupabase.auth.admin.deleteUser(newUser.id);
      return;
    }

    console.log("Full Flow Success!");

  } catch (err) {
    console.error("Exception occurred:", err);
  }
}

testCreateUser();
