const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const prodUrl = process.env.PRODUCTION_DATABASE_URL;
  if (!prodUrl) return;

  const client = new Client({ connectionString: prodUrl });
  await client.connect();

  try {
    const shopId = '4808aee9-9940-410c-aa5b-dd1364e2da2c';

    console.log("Directly updating credit_card_fee_rate to 15 for Tiger Lilly...");
    const res = await client.query(`
      UPDATE system_settings 
      SET credit_card_fee_rate = 15 
      WHERE shop_id = $1 
      RETURNING *
    `, [shopId]);

    console.log("Updated settings:", res.rows[0]);

  } catch (err) {
    console.error("Update failed:", err);
  } finally {
    await client.end();
  }
}

main();
