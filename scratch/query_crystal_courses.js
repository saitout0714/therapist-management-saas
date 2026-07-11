const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.PRODUCTION_DATABASE_URL });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT 
        c.id,
        s.name as shop_name,
        c.name as course_name,
        c.duration,
        c.base_price,
        c.is_active
      FROM public.courses c
      JOIN public.shops s ON c.shop_id = s.id
      WHERE s.name LIKE '%クリスタルスパ%'
      ORDER BY c.duration
    `);
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
