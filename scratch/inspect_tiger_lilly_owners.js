const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const prodUrl = process.env.PRODUCTION_DATABASE_URL;
  if (!prodUrl) return;

  const client = new Client({ connectionString: prodUrl });
  await client.connect();

  try {
    const shopId = '4808aee9-9940-410c-aa5b-dd1364e2da2c';

    // Query shop_owners
    const ownersRes = await client.query(`
      SELECT so.*, u.login_id, u.role
      FROM shop_owners so
      JOIN users u ON so.user_id = u.id
      WHERE so.shop_id = $1
    `, [shopId]);
    
    console.log("=== TIGER LILLY SHOP OWNERS ===");
    console.log(ownersRes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
