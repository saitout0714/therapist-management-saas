const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const prodUrl = process.env.PRODUCTION_DATABASE_URL;
const devUrl = process.env.DEVELOPMENT_DATABASE_URL;

async function run() {
  const query = `ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS phone text;`;

  if (devUrl) {
    console.log('Connecting to dev db...');
    const client = new Client({ connectionString: devUrl });
    await client.connect();
    await client.query(query);
    console.log('Dev DB: Added phone column successfully.');
    await client.end();
  } else {
    console.log('No dev db url found.');
  }

  if (prodUrl) {
    console.log('Connecting to prod db...');
    const client = new Client({ connectionString: prodUrl });
    await client.connect();
    await client.query(query);
    console.log('Prod DB: Added phone column successfully.');
    await client.end();
  } else {
    console.log('No prod db url found.');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
