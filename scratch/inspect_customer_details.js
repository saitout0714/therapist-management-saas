const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.PRODUCTION_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    console.log('--- INSPECTING CUSTOMER DETAIL COLUMNS ---');
    const res = await client.query(`
      SELECT id, name, phone, phone2, email, status, ng_reason, memo, created_at, shop_id
      FROM public.customers
      WHERE name LIKE '%3196%' OR phone LIKE '%3196%' OR phone2 LIKE '%3196%'
    `);

    for (const row of res.rows) {
      console.log(`\nCustomer: ${row.name} (${row.id})`);
      console.log(`  phone:      ${JSON.stringify(row.phone)}`);
      console.log(`  phone2:     ${JSON.stringify(row.phone2)}`);
      console.log(`  email:      ${JSON.stringify(row.email)}`);
      console.log(`  status:     ${JSON.stringify(row.status)}`);
      console.log(`  ng_reason:  ${JSON.stringify(row.ng_reason)}`);
      console.log(`  memo:       ${JSON.stringify(row.memo)}`);
      console.log(`  created_at: ${JSON.stringify(row.created_at)}`);
      console.log(`  shop_id:    ${JSON.stringify(row.shop_id)}`);
    }

  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

run();
