const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration(dbUrl, name) {
  if (!dbUrl) {
    console.log(`Skipping ${name} as no connection URL is defined.`);
    return;
  }
  console.log(`Connecting to ${name}...`);
  const client = new Client({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });
  await client.connect();
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../supabase/add-is-rookie-column.sql'), 'utf8');
    console.log(`Running migration on ${name}...`);
    await client.query(sql);
    console.log(`Migration completed successfully on ${name}.`);
  } catch (err) {
    console.error(`Error running migration on ${name}:`, err);
  } finally {
    await client.end();
  }
}

async function main() {
  await runMigration(process.env.DEVELOPMENT_DATABASE_URL, 'Development DB');
  await runMigration(process.env.PRODUCTION_DATABASE_URL, 'Production DB');
}

main().catch(console.error);
