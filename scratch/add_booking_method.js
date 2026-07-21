const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function runMigration(dbUrl, name) {
  if (!dbUrl) {
    console.log(`[${name}] No URL configured, skipping.`);
    return;
  }
  console.log(`[${name}] Connecting to:`, dbUrl);
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    console.log(`[${name}] Connected successfully.`);
    console.log(`[${name}] Adding booking_method column to reservations table...`);
    await client.query(`
      ALTER TABLE reservations ADD COLUMN IF NOT EXISTS booking_method VARCHAR(50);
    `);
    console.log(`[${name}] Migration completed successfully!`);
  } catch (err) {
    console.error(`[${name}] Error:`, err);
  } finally {
    await client.end();
  }
}

async function main() {
  await runMigration(process.env.PRODUCTION_DATABASE_URL, 'PRODUCTION');
  await runMigration(process.env.DEVELOPMENT_DATABASE_URL, 'DEVELOPMENT');
}

main();
