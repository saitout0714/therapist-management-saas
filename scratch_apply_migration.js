const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = "postgresql://postgres:Al2021al0518@db.pumkniqtgjsotsxhyvbq.supabase.co:6543/postgres";

async function runMigration() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const sql = fs.readFileSync(path.join(__dirname, 'supabase', 'add-esthe-ranking-sync.sql'), 'utf-8');
    await client.query(sql);
    console.log("Migration successful.");
  } catch (err) {
    console.error("Error during migration:", err);
  } finally {
    await client.end();
  }
}

runMigration();
