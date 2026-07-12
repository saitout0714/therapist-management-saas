const { Client } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const dbUrl = process.env.PRODUCTION_DATABASE_URL;

async function run() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const res = await client.query("SELECT id, shop_id, name FROM public.rooms WHERE shop_id = '774101be-d8c5-4ca5-ba4a-fc61c039fbaa'");
    console.log('Shinjuku Himitsuduma Rooms in DB:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
