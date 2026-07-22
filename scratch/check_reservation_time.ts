import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const connectionString = process.env.PRODUCTION_DATABASE_URL;
  if (!connectionString) return;
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res2 = await client.query(`
      SELECT id, therapist_id, date, start_time, end_time, status, created_at, updated_at
      FROM reservations
      WHERE id = '5e6c983d-5f39-42cd-921c-642269fd7a89';
    `);
    console.log('Reservation:', res2.rows[0]);
  } finally {
    await client.end();
  }
}
main();
