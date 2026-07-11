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
    const shukujyoShopId = '3464ed8c-44e8-46f1-b701-9b6ae0f465a8';

    console.log('--- Checking Reservations for Shukujyo ---');
    const { rows: resCount } = await client.query(
      `SELECT COUNT(*) FROM public.reservations WHERE shop_id = $1`,
      [shukujyoShopId]
    );
    console.log(`Total reservations count: ${resCount[0].count}`);

    const { rows: sampleReservations } = await client.query(
      `SELECT r.id, r.date, r.start_time, r.customer_id, c.name as customer_name
       FROM public.reservations r
       LEFT JOIN public.customers c ON r.customer_id = c.id
       WHERE r.shop_id = $1
       LIMIT 20`,
      [shukujyoShopId]
    );
    console.log('Sample reservations:', sampleReservations);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
