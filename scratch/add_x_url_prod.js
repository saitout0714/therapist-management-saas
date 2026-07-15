const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const prodUrl = process.env.PRODUCTION_DATABASE_URL;
  if (!prodUrl) {
    console.error("PRODUCTION_DATABASE_URL not found");
    return;
  }

  console.log("Connecting to PRODUCTION database...");
  const client = new Client({ connectionString: prodUrl });
  await client.connect();

  try {
    const sql = `
      ALTER TABLE therapists
      ADD COLUMN IF NOT EXISTS x_url text;
      
      NOTIFY pgrst, 'reload schema';
    `;
    await client.query(sql);
    console.log("Migration applied to PRODUCTION successfully!");

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

main();
