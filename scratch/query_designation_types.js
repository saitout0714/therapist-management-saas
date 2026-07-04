const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function queryDesignationTypes(url, dbName) {
  if (!url) return;
  console.log(`\n=== designation_types in ${dbName} ===`);
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT 
        dt.id,
        dt.shop_id,
        s.name as shop_name,
        dt.display_name,
        dt.slug,
        dt.is_active
      FROM public.designation_types dt
      JOIN public.shops s ON dt.shop_id = s.id
      ORDER BY s.name, dt.slug
    `);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

async function main() {
  await queryDesignationTypes(process.env.PRODUCTION_DATABASE_URL, "PRODUCTION");
}

main();
