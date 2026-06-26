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
    const shops = [
      { id: '92c51e51-339b-48ce-8535-0f45c859b195', name: '辻堂茅ヶ崎' },
      { id: '1faab510-3c7e-4a01-9ce6-d3b93bbdad81', name: 'クリスタルスパ' },
      { id: 'da3ac7a8-e84d-4dbd-830c-81e9e8b6631a', name: '裏妻SPA' }
    ];

    console.log('=== Shop Google Calendar Sync Settings ===');
    for (const shop of shops) {
      const { rows: settings } = await client.query(
        `SELECT google_calendar_id, gas_calendar_sync_url
         FROM public.system_settings 
         WHERE shop_id = $1`,
        [shop.id]
      );
      if (settings.length > 0) {
        console.log(`\nShop: ${shop.name} (${shop.id})`);
        console.log(`  Google Calendar ID: ${settings[0].google_calendar_id}`);
        console.log(`  GAS Calendar Sync URL: ${settings[0].gas_calendar_sync_url}`);
      } else {
        console.log(`\nShop: ${shop.name} (${shop.id}) => NO system_settings found`);
      }
    }

    console.log('\n=== Last 10 Successful Google Calendar Imports (Notes = Googleカレンダーよりインポート) ===');
    for (const shop of shops) {
      const { rows: importedList } = await client.query(
        `SELECT r.id, r.date, r.start_time, r.created_at, c.name as customer_name, t.name as therapist_name
         FROM public.reservations r
         LEFT JOIN public.customers c ON r.customer_id = c.id
         LEFT JOIN public.therapists t ON r.therapist_id = t.id
         WHERE r.shop_id = $1 AND r.notes = 'Googleカレンダーよりインポート'
         ORDER BY r.created_at DESC
         LIMIT 10`,
        [shop.id]
      );
      
      console.log(`\nShop: ${shop.name} - Last Imports Count: ${importedList.length}`);
      importedList.forEach(r => {
        console.log(`  - ResID: ${r.id} | Date: ${r.date} ${r.start_time} | CreatedAt: ${r.created_at} | Customer: ${r.customer_name} | Therapist: ${r.therapist_name}`);
      });
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
