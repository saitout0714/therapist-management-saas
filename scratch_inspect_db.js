const { Client } = require('pg');

const connectionString = "postgresql://postgres:Al2021al0518@db.pumkniqtgjsotsxhyvbq.supabase.co:6543/postgres";

async function inspect() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("=== ALL AUTH.USERS ===");
    const usersRes = await client.query(`
      SELECT id, email, created_at, raw_user_meta_data->>'role' as metadata_role
      FROM auth.users
      ORDER BY created_at DESC;
    `);
    console.log(usersRes.rows);

  } catch (err) {
    console.error("Error during inspection:", err);
  } finally {
    await client.end();
  }
}

inspect();

