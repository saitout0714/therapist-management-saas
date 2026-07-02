const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const devUrl = process.env.DEVELOPMENT_DATABASE_URL;
  if (!devUrl) return;

  const client = new Client({ connectionString: devUrl });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'shop_back_rules'
    `);
    console.log("=== COLUMNS OF shop_back_rules (DEVELOPMENT) ===");
    console.log(res.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
