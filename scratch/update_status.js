const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.PRODUCTION_DATABASE_URL;

if (!connectionString) {
  console.error("Missing PRODUCTION_DATABASE_URL in .env.local");
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    console.log("Connected to database. Updating statuses...");
    const res = await client.query(
      "UPDATE reservations SET status = 'confirmed' WHERE status = 'completed';"
    );
    console.log(`Success: Updated ${res.rowCount} reservations from 'completed' to 'confirmed'.`);
  } catch (err) {
    console.error("Error running query:", err);
  } finally {
    await client.end();
  }
}

run();
