import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const dbUrl = process.env.DEVELOPMENT_DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;
  if (!dbUrl) {
    console.error('Database URL not found in .env.local');
    process.exit(1);
  }

  console.log('Target database URL:', dbUrl);

  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.log('Connected to Database successfully.');

    console.log('Adding closing_date column to shops table...');
    await client.query(`
      ALTER TABLE shops ADD COLUMN IF NOT EXISTS closing_date integer NOT NULL DEFAULT 20;
    `);

    console.log('Database migration completed successfully!');
  } catch (err) {
    console.error('Error during migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
