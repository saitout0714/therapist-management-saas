import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prodUrl = process.env.PRODUCTION_DATABASE_URL;
const devUrl = process.env.DEVELOPMENT_DATABASE_URL;

async function run() {
  const query = `ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS allow_new_customers boolean NOT NULL DEFAULT true;`;

  if (devUrl) {
    console.log('Connecting to dev db...');
    const client = new Client({ connectionString: devUrl });
    await client.connect();
    await client.query(query);
    console.log('Dev DB: Added allow_new_customers column successfully.');
    await client.end();
  } else {
    console.log('No dev db url found.');
  }

  if (prodUrl) {
    console.log('Connecting to prod db...');
    const client = new Client({ connectionString: prodUrl });
    await client.connect();
    await client.query(query);
    console.log('Prod DB: Added allow_new_customers column successfully.');
    await client.end();
  } else {
    console.log('No prod db url found.');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
