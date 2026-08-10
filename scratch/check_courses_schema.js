require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function check() {
  console.log("Checking courses table...");
  const { data: shops } = await supabase.from("shops").select("id, name, slug").limit(5);
  console.log("Shops:", shops);

  if (!shops || shops.length === 0) return;
  const shopId = shops[0].id;

  const testPayload = {
    shop_id: shopId,
    name: "Test Course " + Date.now(),
    duration: 60,
    base_price: 5000,
    back_amount: 2000,
    description: "test",
    is_active: true,
    display_order: 99,
    category_name: "Test Category",
  };

  console.log("Attempting to insert into courses:", testPayload);
  const { data: inserted, error: insertErr } = await supabase.from("courses").insert([testPayload]).select();
  if (insertErr) {
    console.error("Insert Error:", insertErr);
  } else {
    console.log("Insert Success:", inserted);
    // Cleanup
    await supabase.from("courses").delete().eq("id", inserted[0].id);
  }
}

check();
