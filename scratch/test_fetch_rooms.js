require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function testRoomsFetch() {
  const { data: shop } = await supabase.from("shops").select("id").eq("slug", "onyankospa").single();
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name, display_name, address, google_map_url, memo")
    .eq("shop_id", shop.id)
    .order("order", { ascending: true, nullsFirst: false });

  console.log("Fetched rooms for Access page:", rooms);
}

testRoomsFetch();
