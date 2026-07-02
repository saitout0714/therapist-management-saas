import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const devUrl = process.env.DEVELOPMENT_DATABASE_URL;
  const prodUrl = process.env.PRODUCTION_DATABASE_URL;

  const runMigration = async (dbUrl: string, name: string) => {
    console.log(`Connecting to ${name} database...`);
    const client = new Client({ connectionString: dbUrl });
    try {
      await client.connect();
      console.log(`Connected to ${name} successfully.`);
      
      // カラム追加
      console.log('Adding "customer_type_override" column if not exists...');
      await client.query(`
        ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS "customer_type_override" text;
      `);
      
      console.log(`${name} database migration completed successfully!`);
    } catch (err) {
      console.error(`Error during ${name} migration:`, err);
    } finally {
      await client.end();
    }
  };

  if (devUrl) {
    await runMigration(devUrl, 'DEVELOPMENT');
  } else {
    console.log('DEVELOPMENT_DATABASE_URL not found.');
  }

  if (prodUrl) {
    await runMigration(prodUrl, 'PRODUCTION');
  } else {
    console.log('PRODUCTION_DATABASE_URL not found.');
  }
}

main();
