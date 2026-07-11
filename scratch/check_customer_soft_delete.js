const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.PRODUCTION_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    console.log('--- INSPECTING COLUMN NAMES AND VALUES FOR SOFT-DELETE ---');
    
    // Get column names of customers table
    const columnsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customers'
    `);
    const cols = columnsRes.rows.map(r => r.column_name);
    console.log('Columns:', cols);

    // Query all columns for the 5 matching customers
    const res = await client.query(`
      SELECT *
      FROM public.customers
      WHERE name LIKE '%3196%' OR phone LIKE '%3196%'
    `);

    res.rows.forEach(row => {
      console.log(`\nCustomer: ${row.name}`);
      cols.forEach(col => {
        if (!['id', 'name', 'phone', 'phone2', 'email', 'status', 'ng_reason', 'memo', 'created_at', 'shop_id'].includes(col)) {
          console.log(`  ${col}: ${JSON.stringify(row[col])}`);
        }
      });
    });

  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

run();
