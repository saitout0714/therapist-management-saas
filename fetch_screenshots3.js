
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const fs = require("fs");
async function run() {
  const { data, error } = await supabase.storage.from("therapist-photos").list("debug", { limit: 15, sortBy: { column: "created_at", order: "desc" } });
  if (error) {
    console.error("Error fetching files:", error);
  } else {
    for (const f of data) {
      if (new Date(f.created_at) > new Date(Date.now() - 1000 * 60 * 15)) { // last 15 mins
        console.log("Fetching new file:", f.name);
        const { data: fileData } = await supabase.storage.from("therapist-photos").download("debug/" + f.name);
        if (fileData) {
          const buffer = Buffer.from(await fileData.arrayBuffer());
          fs.writeFileSync("C:\\\\Users\\\\user\\\\.gemini\\\\antigravity\\\\brain\\\\22961ab7-2266-437a-a2cc-e4117b7c2357\\\\" + f.name, buffer);
        }
      }
    }
    console.log("Done fetching new screenshots.");
  }
}
run();

