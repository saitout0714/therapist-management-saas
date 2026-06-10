const { Client } = require('pg');
const connectionString = "postgresql://postgres:al2021al0518@db.gzxzrohagleofxjntmpl.supabase.co:6543/postgres";

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to PostgreSQL successfully.');

  const codesRes = await client.query('SELECT shop_id, code, is_active FROM shop_reservation_codes');
  console.log('--- Reservation Codes ---');
  console.log(codesRes.rows);

  const resRes = await client.query(`
    SELECT r.id, r.created_at, r.shop_id, s.name as shop_name, r.source, r.designation_type 
    FROM reservations r
    JOIN shops s ON s.id = r.shop_id
    ORDER BY r.created_at DESC
    LIMIT 3;
  `);
  console.log('--- Recent Reservations ---');
  console.log(resRes.rows);

  await client.end();
}

run().catch(console.error);
