const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const prodUrl = process.env.PRODUCTION_DATABASE_URL;
  if (!prodUrl) {
    console.error("PRODUCTION_DATABASE_URL not found");
    return;
  }

  const client = new Client({ connectionString: prodUrl });
  await client.connect();

  try {
    const shopId = '4808aee9-9940-410c-aa5b-dd1364e2da2c';
    const res = await client.query(`
      SELECT r.id, r.date, r.start_time, t.name as therapist_name,
             r.base_price, r.options_price, r.nomination_fee, r.discount_amount,
             r.therapist_back_amount, r.shop_revenue, r.total_price,
             r.back_calculated_at
      FROM reservations r
      JOIN therapists t ON r.therapist_id = t.id
      WHERE r.shop_id = $1
      ORDER BY r.date DESC, r.start_time DESC
      LIMIT 10
    `, [shopId]);

    console.log("=== TIGER LILLY RECENT RESERVATIONS ===");
    for (const row of res.rows) {
      console.log(`\nReservation ID: ${row.id}`);
      console.log(`  Date: ${row.date} ${row.start_time} | Therapist: ${row.therapist_name}`);
      console.log(`  Prices: base=${row.base_price}, options=${row.options_price}, nomination=${row.nomination_fee}, discount=${row.discount_amount}, total=${row.total_price}`);
      console.log(`  Back: therapist_back=${row.therapist_back_amount}, shop_revenue=${row.shop_revenue}`);
      console.log(`  Calculated At: ${row.back_calculated_at}`);

      // Options detail
      const optsRes = await client.query(`
        SELECT ro.*, o.name as option_name
        FROM reservation_options ro
        LEFT JOIN options o ON ro.option_id = o.id
        WHERE ro.reservation_id = $1
      `, [row.id]);
      console.log("  Options detail:");
      optsRes.rows.forEach(o => {
        console.log(`    - ${o.option_name || o.custom_name || 'custom'}: price=${o.price}, custom_back_amount=${o.custom_back_amount}`);
      });
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
