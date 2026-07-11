const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function queryDb(connectionString, label) {
  console.log(`\n========================================`);
  console.log(`Connecting to ${label}...`);
  console.log(`========================================`);
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const shopId = '4808aee9-9940-410c-aa5b-dd1364e2da2c';

    // 1. Shop details
    const shopRes = await client.query('SELECT * FROM shops WHERE id = $1', [shopId]);
    console.log("=== SHOP DETAILS ===");
    console.log(shopRes.rows[0]);

    // 2. Shop Back Rules
    const shopRulesRes = await client.query('SELECT * FROM shop_back_rules WHERE shop_id = $1', [shopId]);
    console.log("\n=== SHOP BACK RULES ===");
    console.log(shopRulesRes.rows);

    // 3. Options
    const optionsRes = await client.query('SELECT id, name, price, back_category, is_active FROM options WHERE shop_id = $1', [shopId]);
    console.log("\n=== OPTIONS ===");
    console.log(optionsRes.rows);

    // 4. Option Back Rules
    const optRulesRes = await client.query('SELECT * FROM option_back_rules WHERE shop_id = $1', [shopId]);
    console.log("\n=== OPTION BACK RULES ===");
    console.log(optRulesRes.rows);

    // 5. Therapist Option Backs
    const therapistOptBacksRes = await client.query(`
      SELECT tob.*, t.name as therapist_name
      FROM therapist_option_backs tob
      JOIN therapists t ON tob.therapist_id = t.id
      WHERE t.shop_id = $1
    `, [shopId]);
    console.log("\n=== THERAPIST OPTION BACKS ===");
    console.log(therapistOptBacksRes.rows);

  } catch (err) {
    console.error(`Error querying ${label}:`, err);
  } finally {
    await client.end();
  }
}

async function main() {
  const devUrl = process.env.DEVELOPMENT_DATABASE_URL;
  const prodUrl = process.env.PRODUCTION_DATABASE_URL;

  if (devUrl) {
    await queryDb(devUrl, 'DEVELOPMENT');
  } else {
    console.log("DEVELOPMENT_DATABASE_URL not found in .env.local");
  }

  if (prodUrl) {
    await queryDb(prodUrl, 'PRODUCTION');
  } else {
    console.log("PRODUCTION_DATABASE_URL not found in .env.local");
  }
}

main();
