require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function testFetch() {
  const { data: shop } = await supabase.from("shops").select("id, slug, name").eq("slug", "onyankospa").single();
  console.log("Onyanko shop:", shop);

  if (!shop) return;

  const { data: courses, error } = await supabase
    .from("courses")
    .select("*")
    .eq("shop_id", shop.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  console.log("Raw courses from DB:", error || courses);
}

testFetch();
