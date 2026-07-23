
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: jobs } = await supabase
    .from("sync_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  
  jobs.forEach(job => {
    console.log(`[${job.created_at}] Status: ${job.status} | Details: ${JSON.stringify(job.result_details)}`);
  });
}
run();

