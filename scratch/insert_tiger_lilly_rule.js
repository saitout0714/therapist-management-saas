const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const prodUrl = process.env.PRODUCTION_DATABASE_URL;
  if (!prodUrl) return;

  const client = new Client({ connectionString: prodUrl });
  await client.connect();

  try {
    const shopId = '4808aee9-9940-410c-aa5b-dd1364e2da2c';

    // すでに存在するかチェック
    const check = await client.query('SELECT * FROM shop_back_rules WHERE shop_id = $1', [shopId]);
    if (check.rows.length > 0) {
      console.log("Rule already exists for Tiger Lilly:", check.rows[0]);
      return;
    }

    console.log("Inserting default shop_back_rule for Tiger Lilly...");
    const sql = `
      INSERT INTO shop_back_rules (
        shop_id,
        course_calc_type, course_back_rate, course_back_amount,
        option_calc_type, option_back_rate, option_back_amount,
        nomination_calc_type, nomination_back_rate, nomination_back_amount,
        rounding_method, business_day_cutoff, discount_therapist_burden
      ) VALUES (
        $1, 'fixed', 0, 0, 'fixed', 0, 0, 'fixed', 0, 0, 'floor', '06:00:00', 0
      ) RETURNING *
    `;

    const res = await client.query(sql, [shopId]);
    console.log("Inserted successfully:", res.rows[0]);

  } catch (err) {
    console.error("Error inserting rule:", err);
  } finally {
    await client.end();
  }
}

main();
