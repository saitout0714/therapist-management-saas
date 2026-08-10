require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function inspectCourses() {
  const { data: shop } = await supabase.from("shops").select("id, slug, name").eq("slug", "onyankospa").single();
  console.log("Onyanko shop id:", shop.id);

  const { data: courses } = await supabase
    .from("courses")
    .select("id, name, duration, base_price, category_name, is_active, display_order")
    .eq("shop_id", shop.id);

  console.log("All courses for onyankospa in DB:", courses);
}

inspectCourses();
