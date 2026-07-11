const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.PRODUCTION_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    console.log('--- GETTING ALPHABETICAL ORDER INDEX OF ALL CUSTOMERS IN SHOP ---');
    // Fetch all customers for 辻堂茅ヶ崎 ordered by name
    const res = await client.query(`
      SELECT id, name, phone
      FROM public.customers
      WHERE shop_id = '92c51e51-339b-48ce-8535-0f45c859b195'
      ORDER BY name
    `);

    console.log(`Total customers in shop: ${res.rows.length}`);

    const targets = [
      'いしい1967',
      'いずみ6420',
      'たなか9090',
      'ところ3196',
      'はにゅう1962'
    ];

    res.rows.forEach((row, index) => {
      if (targets.includes(row.name)) {
        console.log(`Index: ${index + 1} | Name: ${row.name} | Phone: ${row.phone}`);
      }
    });

  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

run();
