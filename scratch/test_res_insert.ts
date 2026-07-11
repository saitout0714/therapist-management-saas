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

    console.log('--- Fetching a valid therapist and customer from Crystal Spa ---');
    const { rows: therapists } = await client.query(
      `SELECT id, name FROM public.therapists WHERE shop_id = $1 LIMIT 1`,
      [shopId]
    );
    const { rows: customers } = await client.query(
      `SELECT id, name FROM public.customers WHERE shop_id = $1 LIMIT 1`,
      [shopId]
    );

    if (therapists.length === 0 || customers.length === 0) {
      console.error('Therapist or Customer not found in DB for Crystal Spa');
      return;
    }

    const therapistId = therapists[0].id;
    const customerId = customers[0].id;
    console.log(`Using Therapist: ${therapists[0].name} (${therapistId})`);
    console.log(`Using Customer: ${customers[0].name} (${customerId})`);

    console.log('\n--- Simulating reservation insert (same fields as import_calendar.gs) ---');
    
    // We will run this inside a transaction and rollback to keep the DB clean
    await client.query('BEGIN');

    const query = `
      INSERT INTO public.reservations (
        id,
        shop_id,
        therapist_id,
        customer_id,
        date,
        business_date,
        start_time,
        end_time,
        status,
        designation_type,
        designation_type_id,
        course_id,
        base_price,
        total_price,
        payment_method,
        options_payment_method,
        extension_payment_method,
        customer_notified,
        therapist_notified,
        notes
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING id
    `;

    const values = [
      shopId,
      therapistId,
      customerId,
      '2026-07-10', // date
      '2026-07-10', // business_date
      '12:00:00',   // start_time
      '13:00:00',   // end_time
      'confirmed',  // status
      'free',       // designation_type
      null,         // designation_type_id
      null,         // course_id
      0,            // base_price
      0,            // total_price
      'cash',       // payment_method
      'cash',       // options_payment_method
      'cash',       // extension_payment_method
      true,         // customer_notified
      true,         // therapist_notified
      'Googleカレンダーよりインポート (Test Run)' // notes
    ];

    const res = await client.query(query, values);
    console.log('✅ Success! Test reservation inserted with ID:', res.rows[0].id);

    console.log('Rolling back transaction to keep database clean...');
    await client.query('ROLLBACK');

  } catch (err) {
    console.error('❌ Insert failed! Error details:');
    console.error(err);
    await client.query('ROLLBACK').catch(() => {});
  } finally {
    await client.end();
  }
}

run();
