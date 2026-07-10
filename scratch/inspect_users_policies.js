const { Client } = require('pg');

const connectionString = "postgresql://postgres:Al2021al0518@db.pumkniqtgjsotsxhyvbq.supabase.co:6543/postgres";

async function inspect() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("=== RLS POLICIES ON 'users' ===");
    const policiesRes = await client.query(`
      SELECT policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = 'users';
    `);
    console.log(policiesRes.rows);

  } catch (err) {
    console.error("Error during inspection:", err);
  } finally {
    await client.end();
  }
}

inspect();
