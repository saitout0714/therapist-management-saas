require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function checkRooms() {
  const { data: rooms, error } = await supabase.from("rooms").select("*").limit(5);
  console.log("Rooms sample data / schema:", error || rooms);
}

checkRooms();
