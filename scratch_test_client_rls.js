require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// クライアント側と同じ、通常の Supabase クライアント（Service Role ではなく Anon Key を使用）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testRLS() {
  const loginId = "test_simple_client_owner_1783674393778";
  const email = `${loginId}@yoyakl.tokyo`;
  const password = "password123";

  console.log(`Attempting login as ${email}...`);

  try {
    // 1. ログイン
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error("Login failed:", authError);
      return;
    }

    console.log("Logged in successfully! User ID:", authData.user.id);

    // ログインユーザーに割り当てられている店舗のUUIDを調べる
    const { data: shopOwners, error: fetchOwnerError } = await supabase
      .from('shop_owners')
      .select('shop_id')
      .eq('user_id', authData.user.id);

    if (fetchOwnerError || !shopOwners || shopOwners.length === 0) {
      console.error("Failed to fetch assigned shop:", fetchOwnerError);
      return;
    }

    const shopId = shopOwners[0].shop_id;
    console.log("Assigned Shop ID:", shopId);

    // 2. この店舗（shopId）に対して、courses テーブルにインサートを試みる
    console.log("Testing INSERT into 'courses'...");
    const { data: courseData, error: courseInsertError } = await supabase
      .from('courses')
      .insert([{
        shop_id: shopId,
        name: "Test Course via Simple Client Owner",
        duration: 60,
        base_price: 5000,
        back_amount: 1000,
        is_active: true,
        display_order: 99
      }])
      .select();

    if (courseInsertError) {
      console.error("INSERT into 'courses' failed:", courseInsertError);
    } else {
      console.log("INSERT into 'courses' Success! Data:", courseData);
      
      // 3. インサートしたコースを削除しておく
      const courseId = courseData[0].id;
      console.log("Cleaning up created course ID:", courseId);
      const { error: deleteError } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);
      if (deleteError) {
        console.error("Cleanup failed:", deleteError);
      } else {
        console.log("Cleanup Success!");
      }
    }

    // 4. system_settings の INSERT を試みる
    console.log("Testing INSERT into 'system_settings'...");
    const { data: insertedSettings, error: insertSettingsError } = await supabase
      .from('system_settings')
      .insert([{
        shop_id: shopId,
        default_nomination_fee: 1000,
        default_confirmed_nomination_fee: 2000,
        default_princess_reservation_fee: 3000,
        reservation_interval_minutes: 20
      }])
      .select();

    if (insertSettingsError) {
      console.error("INSERT into 'system_settings' failed:", insertSettingsError);
    } else {
      console.log("INSERT into 'system_settings' Success! Data:", insertedSettings);
      
      // クリーンアップのために削除
      const settingsId = insertedSettings[0].id;
      console.log("Cleaning up created system settings ID:", settingsId);
      const { error: deleteSettingsError } = await supabase
        .from('system_settings')
        .delete()
        .eq('id', settingsId);
      if (deleteSettingsError) {
        console.error("Cleanup settings failed:", deleteSettingsError);
      } else {
        console.log("Cleanup settings Success!");
      }
    }

  } catch (err) {
    console.error("Exception occurred:", err);
  }
}

testRLS();



