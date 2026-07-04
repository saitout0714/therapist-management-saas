const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function queryCourses(url, dbName) {
  if (!url) return;
  console.log(`\n=== courses in ${dbName} ===`);
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT 
        c.id,
        c.shop_id,
        s.name as shop_name,
        c.name as course_name,
        c.duration,
        c.base_price,
        c.is_active
      FROM public.courses c
      JOIN public.shops s ON c.shop_id = s.id
      ORDER BY s.name, c.duration
    `);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

async function main() {
  await queryCourses(process.env.PRODUCTION_DATABASE_URL, "PRODUCTION");
}

main();
