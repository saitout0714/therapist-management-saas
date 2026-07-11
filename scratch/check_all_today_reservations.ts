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
    const todayJstStart = '2026-06-26 00:00:00+09'; // JST today

    console.log('=== All reservations created today across ALL shops (JST 2026-06-26) ===');
    const { rows: resList } = await client.query(
      `SELECT r.id, r.date, r.start_time, r.end_time, r.google_event_id, r.created_at, r.notes, r.source, c.name as customer_name, t.name as therapist_name, s.name as shop_name
       FROM public.reservations r
       LEFT JOIN public.customers c ON r.customer_id = c.id
       LEFT JOIN public.therapists t ON r.therapist_id = t.id
       LEFT JOIN public.shops s ON r.shop_id = s.id
       WHERE r.created_at >= $1
       ORDER BY r.created_at DESC`,
      [todayJstStart]
    );

    console.log(`Total reservations created today: ${resList.length}`);
    resList.forEach(r => {
      console.log(`\n- ResID: ${r.id} | Shop: ${r.shop_name}`);
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
