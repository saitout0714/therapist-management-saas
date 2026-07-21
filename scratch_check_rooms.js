const { Client } = require('pg');
const connectionString = "postgresql://postgres:Al2021al0518@db.pumkniqtgjsotsxhyvbq.supabase.co:6543/postgres";

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const shopIds = [
      'e6b1cc21-c9eb-4fc1-888d-6f965a90c1df',
      '508def9b-cd72-439d-9bbc-2dbe5e3a8af4',
      '11013a02-86fe-4675-83e2-9e11f459d416',
      'b99522d0-5166-4f7d-87d5-801699f5ba3c'
    ];
    const res = await client.query(
      "SELECT shop_id, id, name, display_name FROM public.rooms WHERE shop_id = ANY($1)",
      [shopIds]
    );
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
