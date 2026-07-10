const { Client } = require('pg');

const connectionString = "postgresql://postgres:Al2021al0518@db.pumkniqtgjsotsxhyvbq.supabase.co:6543/postgres";

async function inspect() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("=== TRIGGERS ON ALL TABLES ===");
    const triggersRes = await client.query(`
      SELECT 
        event_object_table AS table_name,
        trigger_name,
        event_manipulation AS event,
        action_statement AS action,
        action_timing AS timing
      FROM information_schema.triggers
      ORDER BY event_object_table, trigger_name;
    `);
    console.log(JSON.stringify(triggersRes.rows, null, 2));

  } catch (err) {
    console.error("Error during inspection:", err);
  } finally {
    await client.end();
  }
}

inspect();
