const { createClient } = require('@supabase/supabase-js');
const dbUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const dbKey = 'sb_publishable_PVxVPbhBIRoEOe1IyRx4zA_ofK5vaar';
const supabase = createClient(dbUrl, dbKey);
async function run() {
  const { Client } = require('pg');
  const dotenv = require('dotenv');
  const path = require('path');
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  const connectionString = process.env.PRODUCTION_DATABASE_URL;

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const res = await client.query(`
      SELECT 
        s.name as shop_name,
        COUNT(*) as total_customers,
        COUNT(CASE WHEN c.phone IS NOT NULL AND c.phone <> '' THEN 1 END) as customers_with_phone
      FROM customers c
      LEFT JOIN shops s ON c.shop_id = s.id
      GROUP BY s.name
      ORDER BY total_customers DESC;
    `);
    console.log('Customer and Phone Registration Counts by Shop:');
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();
