const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const url = process.env.PRODUCTION_DATABASE_URL || process.env.DEVELOPMENT_DATABASE_URL;
  if (!url) {
    console.log("No database URL found in env.");
    return;
  }
  
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const resId = '770956b9-c367-41b3-a47a-08e2937dff13';
    
    console.log("--- Reservation Details ---");
    const res = await client.query('SELECT * FROM public.reservations WHERE id = $1', [resId]);
    console.log(res.rows[0]);

    console.log("--- Reservation Options ---");
    const options = await client.query('SELECT * FROM public.reservation_options WHERE reservation_id = $1', [resId]);
    console.log(options.rows);

    console.log("--- Reservation Discounts ---");
    const discounts = await client.query('SELECT * FROM public.reservation_discounts WHERE reservation_id = $1', [resId]);
    console.log(discounts.rows);

  } catch (err) {
    console.error("Error running query:", err);
  } finally {
    await client.end();
  }
}

run();
