const { Client } = require('pg');

const connectionString = "postgresql://postgres:Al2021al0518@db.pumkniqtgjsotsxhyvbq.supabase.co:6543/postgres";

async function inspect() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("=== CHECK CONSTRAINTS ON 'users' ===");
    const constraintsRes = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) 
      FROM pg_constraint c 
      JOIN pg_class t ON t.oid = c.conrelid 
      WHERE t.relname = 'users';
    `);
    console.log(constraintsRes.rows);

    console.log("\n=== TRIGGER FUNCTION 'handle_new_auth_user' ===");
    const triggerFuncRes = await client.query(`
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE proname = 'handle_new_auth_user';
    `);
    if (triggerFuncRes.rows.length > 0) {
      console.log(triggerFuncRes.rows[0].prosrc);
    } else {
      console.log("Function 'handle_new_auth_user' not found!");
    }

    console.log("\n=== UNIQUE ROLES IN 'users' ===");
    const rolesRes = await client.query(`
      SELECT role, count(*) FROM users GROUP BY role;
    `);
    console.log(rolesRes.rows);

  } catch (err) {
    console.error("Error during inspection:", err);
  } finally {
    await client.end();
  }
}

inspect();
