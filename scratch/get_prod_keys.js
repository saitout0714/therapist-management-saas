const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.PRODUCTION_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    console.log('--- FETCHING SUPABASE SECRETS FROM VAULT ---');
    const res = await client.query(`
      SELECT name, decrypted_secret 
      FROM vault.decrypted_secrets
    `);
    console.log(res.rows);

  } catch (err) {
    console.error('Error fetching from vault.decrypted_secrets:', err.message);
    try {
      // Fallback if decrypted_secrets is not readable or configured differently
      const res2 = await client.query(`
        SELECT * FROM pg_catalog.pg_tables WHERE schemaname = 'vault'
      `);
      console.log('Vault tables:', res2.rows);
    } catch (err2) {
      console.error('Vault schema check failed:', err2.message);
    }
  } finally {
    await client.end();
  }
}

run();
