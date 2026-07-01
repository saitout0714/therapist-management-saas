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
    const res = await client.query(`
      SELECT s.id, s.name, s.short_name,
             r.course_calc_type, r.course_back_rate,
             r.option_calc_type, r.option_back_rate,
             r.nomination_calc_type, r.nomination_back_rate
      FROM shops s
      LEFT JOIN shop_back_rules r ON s.id = r.shop_id
      WHERE s.is_active = true
      ORDER BY s.name
    `);

    console.log("=== ACTIVE SHOPS AND THEIR BACK RULES ===");
    res.rows.forEach(row => {
      console.log(`\nShop: ${row.name} (${row.id})`);
      if (row.course_calc_type === null) {
        console.log("  -> NO BACK RULES FOUND IN DB");
      } else {
        console.log(`  Course: ${row.course_calc_type} | rate: ${row.course_back_rate}%`);
        console.log(`  Option: ${row.option_calc_type} | rate: ${row.option_back_rate}%`);
        console.log(`  Nomination: ${row.nomination_calc_type} | rate: ${row.nomination_back_rate}%`);
      }
    });

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
