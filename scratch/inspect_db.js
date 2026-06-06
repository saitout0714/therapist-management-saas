const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

// We need the database connection string.
// The connection string is usually in the format: postgresql://postgres:[password]@db.pumkniqtgjsotsxhyvbq.supabase.co:5432/postgres
// Let's try to construct it using the URL or check if there is a DATABASE_URL in environment.
// Since NEXT_PUBLIC_SUPABASE_URL is https://pumkniqtgjsotsxhyvbq.supabase.co
// The host name for the DB is db.pumkniqtgjsotsxhyvbq.supabase.co
// We need the user to supply the database password to connect.
// If the user hasn't provided the password yet, let's ask them or check if there's a connection string.

const dbPassword = process.env.SUPABASE_DB_PASSWORD || ''; // We might need to ask the user for this or put it in .env.local
const projectRef = 'pumkniqtgjsotsxhyvbq';
const connectionString = process.env.DATABASE_URL || `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:6543/postgres`;

if (!dbPassword && !process.env.DATABASE_URL) {
  console.error('❌ Database password or DATABASE_URL not set in env.');
  console.log('Please add SUPABASE_DB_PASSWORD="your-db-password" or DATABASE_URL to .env.local');
  process.exit(1);
}

async function inspectSchema() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('✅ Connected to database!');

    // 1. Query all tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log('\n=== Tables found in public schema ===');
    console.log(tables.join(', '));

    // 2. Query columns and types for each table
    for (const table of tables) {
      console.log(`\n--- Table: ${table} ---`);
      const columnsRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);
      
      columnsRes.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultValue = col.column_default ? `DEFAULT ${col.column_default}` : '';
        console.log(`  ${col.column_name} (${col.data_type}) ${nullable} ${defaultValue}`);
      });
    }

  } catch (err) {
    console.error('❌ Error inspecting schema:', err.message);
  } finally {
    await client.end();
  }
}

inspectSchema();
