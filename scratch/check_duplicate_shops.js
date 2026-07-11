const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.PRODUCTION_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    console.log('--- CHECKING FOR DUPLICATE SHOPS ---');
    const res = await client.query(`
      SELECT id, name, created_at 
      FROM public.shops 
      WHERE name LIKE '%辻堂%' OR name LIKE '%茅ヶ崎%'
    `);
    console.log(res.rows);

  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

run();
