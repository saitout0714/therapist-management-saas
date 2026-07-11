import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Force connection to development database
const dbUrl = process.env.DEVELOPMENT_DATABASE_URL;

async function run() {
  if (!dbUrl) {
    console.error('No DEVELOPMENT_DATABASE_URL');
    return;
  }
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    console.log('=== Connected to DEVELOPMENT Database (gzxzrohagleofxjntmpl) ===');
    
    const { rows: resList } = await client.query(
      `SELECT r.id, r.date, r.start_time, r.google_event_id, r.created_at, r.notes, r.source, c.name as customer_name, t.name as therapist_name, s.name as shop_name
       FROM public.reservations r
       LEFT JOIN public.customers c ON r.customer_id = c.id
       LEFT JOIN public.therapists t ON r.therapist_id = t.id
       LEFT JOIN public.shops s ON r.shop_id = s.id
       WHERE r.created_at >= NOW() - INTERVAL '2 days'
       ORDER BY r.created_at DESC
       LIMIT 10`
    );
    
    console.log(`\nRecent Reservations Count in DEV DB (last 2 days): ${resList.length}`);
    resList.forEach(r => {
      console.log(`  - ResID: ${r.id} | Shop: ${r.shop_name} | Date: ${r.date} ${r.start_time} | CreatedAt: ${r.created_at}`);
      console.log(`    Customer: ${r.customer_name} | Therapist: ${r.therapist_name} | EventID: ${r.google_event_id}`);
      console.log(`    Source: ${r.source} | Notes: ${r.notes}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
