import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const connectionString = process.env.PRODUCTION_DATABASE_URL;
  if (!connectionString) return;
  const client = new Client({ connectionString });
  await client.connect();

  const shopId = 'dc3caa06-fcc2-4bdc-b063-7969296efd34';

  // 1. セラピスト「いずみ」の情報
  const therapistRes = await client.query(`
    SELECT id, name, estama_therapist_id, esthe_ranking_therapist_id
    FROM therapists
    WHERE shop_id = $1 AND name LIKE '%いずみ%';
  `, [shopId]);
  console.log('Therapist Izumi:', therapistRes.rows);

  if (therapistRes.rows.length === 0) {
    console.log('No therapist named Izumi found in Asakusabashi shop!');
    await client.end();
    return;
  }

  const izumiId = therapistRes.rows[0].id;

  // 2. 7/25のシフト情報
  const shiftRes = await client.query(`
    SELECT id, date, start_time, end_time
    FROM shifts
    WHERE therapist_id = $1 AND date = '2026-07-25';
  `, [izumiId]);
  console.log('Shift for Izumi on 7/25:', shiftRes.rows);

  // 3. 7/25の予約情報
  const resRes = await client.query(`
    SELECT id, date, start_time, end_time, status
    FROM reservations
    WHERE therapist_id = $1 AND date = '2026-07-25';
  `, [izumiId]);
  console.log('Reservation for Izumi on 7/25:', resRes.rows);

  await client.end();
}

main();
