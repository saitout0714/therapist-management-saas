
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.storage.from("therapist-photos").list("debug", { limit: 20, sortBy: { column: "created_at", order: "desc" } });
  if (error) {
    console.error("Error fetching files:", error);
  } else {
    console.log("Recent debug screenshots:");
    data.forEach(f => console.log(f.name, f.created_at));
  }
}
run();

