import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const dbUrl = process.env.PRODUCTION_DATABASE_URL;

async function run() {
  if (!dbUrl) {
    console.error('No PRODUCTION_DATABASE_URL');
    return;
  }
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const shopId = '1faab510-3c7e-4a01-9ce6-d3b93bbdad81'; // Crystal Spa
    const todayJstStart = '2026-06-26 00:00:00+09'; // JST today

    console.log('=== All reservations created today (JST 2026-06-26) ===');
    const { rows: resList } = await client.query(
      `SELECT r.id, r.date, r.start_time, r.end_time, r.google_event_id, r.created_at, r.notes, r.source, c.name as customer_name, t.name as therapist_name
       FROM public.reservations r
       LEFT JOIN public.customers c ON r.customer_id = c.id
       LEFT JOIN public.therapists t ON r.therapist_id = t.id
       WHERE r.shop_id = $1 AND r.created_at >= $2
       ORDER BY r.created_at DESC`,
      [shopId, todayJstStart]
    );

    console.log(`Total reservations created today: ${resList.length}`);
    resList.forEach(r => {
      console.log(`\n- ResID: ${r.id}`);
      console.log(`  CreatedAt: ${r.created_at}`);
      console.log(`  Date/Time: ${r.date} ${r.start_time} ~ ${r.end_time}`);
      console.log(`  Customer: ${r.customer_name} | Therapist: ${r.therapist_name}`);
      console.log(`  EventID: ${r.google_event_id}`);
      console.log(`  Source: ${r.source} | Notes: ${r.notes}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
