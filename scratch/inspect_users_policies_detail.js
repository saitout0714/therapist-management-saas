const { Client } = require('pg');

const connectionString = "postgresql://postgres:Al2021al0518@db.pumkniqtgjsotsxhyvbq.supabase.co:6543/postgres";

async function inspect() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("=== DETAIL POLICIES ON 'users' ===");
    const policiesRes = await client.query(`
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE tablename = 'users';
    `);
    console.log(policiesRes.rows);

    console.log("\n=== RLS STATUS WITH SCHEMAS ===");
    const rlsRes = await client.query(`
      SELECT n.nspname AS schemaname, c.relname, c.relrowsecurity 
      FROM pg_class c 
      JOIN pg_namespace n ON n.oid = c.relnamespace 
      WHERE c.relname = 'users';
    `);
    console.log(rlsRes.rows);

  } catch (err) {
    console.error("Error during inspection:", err);
  } finally {
    await client.end();
  }
}

inspect();
