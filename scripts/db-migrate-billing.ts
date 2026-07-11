import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrateDb(dbUrl: string, name: string) {
  console.log(`\n--- Starting migration on ${name} ---`);
  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.log(`Connected to ${name} successfully.`);

    console.log('Adding closing_date column to shops table...');
    await client.query(`
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS closing_date integer NOT NULL DEFAULT 20;
    `);

    console.log('Notifying PostgREST to reload schema cache...');
    await client.query("NOTIFY pgrst, 'reload schema';");

    console.log(`Migration and schema reload on ${name} completed successfully!`);
  } catch (err) {
    console.error(`Error during migration on ${name}:`, err);
  } finally {
    await client.end();
  }
}

async function main() {
  const devUrl = process.env.DEVELOPMENT_DATABASE_URL;
  const prodUrl = process.env.PRODUCTION_DATABASE_URL;

  if (!devUrl && !prodUrl) {
    console.error('No database URLs found in .env.local');
    process.exit(1);
  }

  if (devUrl) {
    await migrateDb(devUrl, 'DEVELOPMENT DATABASE');
  }
  if (prodUrl) {
    await migrateDb(prodUrl, 'PRODUCTION DATABASE');
  }
  
  console.log('\nAll migrations and schema reloads completed!');
}

main();
