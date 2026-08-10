require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function inspectOnyankoRooms() {
  const { data: shop } = await supabase.from("shops").select("id, slug, name").eq("slug", "onyankospa").single();
  console.log("Onyanko shop:", shop);

  const { data: rooms, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("shop_id", shop.id)
    .order("order", { ascending: true, nullsFirst: false });

  console.log("Onyanko rooms in DB:", error || rooms);
}

inspectOnyankoRooms();
