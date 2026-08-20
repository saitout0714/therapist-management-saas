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
      ALTER TABLE news_items ADD COLUMN IF NOT EXISTS image_url text;
    `);

    console.log(`${label}: news_items.image_url column ensured.`);
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
