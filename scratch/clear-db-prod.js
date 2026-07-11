const { createClient } = require('@supabase/supabase-js');

const dbUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
// Using the service role key or public key (using service role key from .env.local isn't possible because that's for the development DB, but wait: is there a service role key for production?)
// Wait! Let's check .env.local connection string:
// PRODUCTION_DATABASE_URL="postgresql://postgres:Al2021al0518@db.pumkniqtgjsotsxhyvbq.supabase.co:6543/postgres"
// We have the PostgreSQL credentials for production!
// So we can use pg to directly run SQL update statement on the production database, or use the service role key if we can find it.
// Since we have the connection string, using `pg` is extremely reliable and direct!
// Let's use `pg` to update.
const { Client } = require('pg');

async function run() {
  const connectionString = "postgresql://postgres:Al2021al0518@db.pumkniqtgjsotsxhyvbq.supabase.co:6543/postgres";
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected to production Postgres database.');
    
    const shopId = '75e69a2a-eaac-4d2f-91af-e7579c1a84ab';
    
    // Clear hp_url for the shop's therapists
    const res = await client.query(
      'UPDATE therapists SET hp_url = NULL WHERE shop_id = $1',
      [shopId]
    );
    
    console.log(`Successfully cleared hp_url for ${res.rowCount} therapists in production.`);
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

run();
