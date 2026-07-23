
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.storage.from("therapist-photos").upload("debug/test.jpg", Buffer.from("test"), { contentType: "image/jpeg", upsert: true });
  console.log("Upload test:", data, error);
}
run();

