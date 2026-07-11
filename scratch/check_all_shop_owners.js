const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function checkShopOwners(url, dbName) {
  if (!url) return;
  console.log(`\n=== Checking shop_owners in ${dbName} ===`);
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT 
        so.id,
        so.shop_id,
        s.name as shop_name,
        so.user_id,
        u.name as user_name,
        u.role as user_role
      FROM public.shop_owners so
      JOIN public.shops s ON so.shop_id = s.id
      JOIN public.users u ON so.user_id = u.id
    `);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

async function main() {
  await checkShopOwners(process.env.DEVELOPMENT_DATABASE_URL, "DEVELOPMENT");
  await checkShopOwners(process.env.PRODUCTION_DATABASE_URL, "PRODUCTION");
}

main();
