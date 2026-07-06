const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.PRODUCTION_DATABASE_URL;

async function check() {
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    
    // Fetch function definition for check_shop_access
    const res = await client.query(`
      SELECT prosrc 
      FROM pg_proc 
      WHERE proname = 'check_shop_access'
    `);
    
    console.log('--- check_shop_access FUNCTION DEFINITION ---');
    if (res.rows.length > 0) {
      console.log(res.rows[0].prosrc);
    } else {
      console.log('Function not found.');
    }

  } catch (err) {
    console.error('Error querying production DB:', err);
  } finally {
    await client.end();
  }
}

check();
