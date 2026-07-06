const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.PRODUCTION_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    // 1. Get shop owners for 辻堂茅ヶ崎 (92c51e51-339b-48ce-8535-0f45c859b195)
    console.log('--- FETCHING SHOP OWNERS FOR 辻堂茅ヶ崎 ---');
    const shopOwnersRes = await client.query(`
      SELECT user_id, shop_id FROM public.shop_owners 
      WHERE shop_id = '92c51e51-339b-48ce-8535-0f45c859b195'
    `);
    console.log(shopOwnersRes.rows);

    if (shopOwnersRes.rows.length === 0) {
      console.log('No shop owners found for this shop.');
      return;
    }

    const userId = shopOwnersRes.rows[0].user_id;
    console.log(`Using user_id (auth.uid()): ${userId}`);

    // 2. Perform RLS simulated query
    console.log('\n--- SIMULATING RLS QUERY AS AUTHENTICATED USER ---');
    await client.query('BEGIN');
    
    // Set settings to simulate Supabase authenticated user
    await client.query(`SET LOCAL role TO authenticated`);
    await client.query(`SET LOCAL request.jwt.claim.sub TO '${userId}'`);
    
    // Run the same query as new/page.tsx (using ilike simulation via LOWER and %)
    const q = '3196';
    const normalized = '3196';
    const rlsQueryRes = await client.query(`
      SELECT id, name, phone, email, status, shop_id
      FROM public.customers
      WHERE shop_id = '92c51e51-339b-48ce-8535-0f45c859b195'
        AND (
          name ILIKE $1 
          OR phone ILIKE $2 
          OR email ILIKE $1
        )
      ORDER BY name
      LIMIT 50
    `, [`%${q}%`, `%${normalized}%`]);

    console.log(`RLS query returned ${rlsQueryRes.rows.length} rows:`);
    console.log(rlsQueryRes.rows);

    await client.query('COMMIT');
  } catch (err) {
    console.error('Error executing query:', err);
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
  } finally {
    await client.end();
  }
}

run();
