import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrate(label: string, dbUrl: string | undefined) {
  if (!dbUrl) {
    console.log(`${label}: URL not found, skipping.`);
    return;
  }

  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.log(`${label}: Connected.`);

    await client.query(`
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS show_on_timechart BOOLEAN DEFAULT TRUE NOT NULL;
    `);

    console.log(`${label}: show_on_timechart column ensured.`);
  } catch (err) {
    console.error(`${label}: Error during migration:`, err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

async function main() {
  await migrate('PRODUCTION', process.env.PRODUCTION_DATABASE_URL);
}

main();
