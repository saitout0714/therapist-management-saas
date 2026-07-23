
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: jobs, error } = await supabase
    .from("sync_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);
  
  if (error) {
    console.error("Error fetching jobs:", error);
  } else {
    console.log("Last 5 Sync Jobs:");
    jobs.forEach(job => {
      console.log(`[${job.created_at}] ID: ${job.id} | Status: ${job.status} | Type: ${job.sync_type}`);
      if (job.result_details) {
        console.log(`  Details: ${JSON.stringify(job.result_details)}`);
      }
      console.log("---");
    });
  }
}
run();

