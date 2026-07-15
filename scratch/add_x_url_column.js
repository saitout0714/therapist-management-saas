const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const url = process.env.DATABASE_URL || process.env.DEVELOPMENT_DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not found");
    return;
  }

  console.log("Connecting to database...");
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const sql = `
      ALTER TABLE therapists
      ADD COLUMN IF NOT EXISTS x_url text;
    `;
    await client.query(sql);
    console.log("Migration applied successfully!");

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

main();
