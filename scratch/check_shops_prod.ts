import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const connectionString = process.env.PRODUCTION_DATABASE_URL;
  if (!connectionString) {
    console.error('No PRODUCTION_DATABASE_URL found');
    return;
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT id, name, needs_sync, estama_login_id 
      FROM shops 
      WHERE name LIKE '%こころリンス%';
    `);
    console.log('Shops status (Prod DB):', res.rows);
    
    // Check recent webhook logs if any
    const res2 = await client.query(`
      SELECT id, therapist_id, date, start_time, end_time, status
      FROM reservations
      WHERE date = '2026-07-23'
      ORDER BY updated_at DESC
      LIMIT 5;
    `);
    console.log('Recent reservations for 7/23 (Prod DB):', res2.rows);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

main();
