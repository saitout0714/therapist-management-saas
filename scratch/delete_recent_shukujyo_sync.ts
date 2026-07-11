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
    // UTC 09:10:00 JST is 18:10:00 (since sync was at JST 18:13)
    const cutoffTime = '2026-06-26 09:10:00Z'; 

    console.log('--- Cleaning up Recent Sync Data for Shukujyo ---');

    // 1. Delete incorrect reservations
    const { rowCount: deletedResCount } = await client.query(
      `DELETE FROM public.reservations 
       WHERE shop_id = $1 AND created_at >= $2`,
      [shukujyoShopId, cutoffTime]
    );
    console.log(`Deleted reservations count: ${deletedResCount}`);

    // 2. Identify and delete auto-created wrong customers
    const { rows: customersToDelete } = await client.query(
      `SELECT id, name FROM public.customers 
       WHERE shop_id = $1 AND created_at >= $2`,
      [shukujyoShopId, cutoffTime]
    );
    console.log('Customers created during sync:', customersToDelete);

    if (customersToDelete.length > 0) {
      const ids = customersToDelete.map(c => c.id);
      const { rowCount: deletedCustCount } = await client.query(
        `DELETE FROM public.customers WHERE id = ANY($1)`,
        [ids]
      );
      console.log(`Deleted customers count: ${deletedCustCount}`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
