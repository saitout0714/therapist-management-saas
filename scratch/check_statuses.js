const { Client } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const dbUrl = process.env.PRODUCTION_DATABASE_URL;

async function run() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const res = await client.query('SELECT DISTINCT status FROM public.customers');
    console.log('Statuses:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
