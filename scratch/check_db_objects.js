const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const dbPassword = process.env.SUPABASE_DB_PASSWORD || '';
const projectRef = 'pumkniqtgjsotsxhyvbq';
const connectionString = process.env.DATABASE_URL || `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:6543/postgres`;

if (!dbPassword && !process.env.DATABASE_URL) {
  console.error('❌ Database password or DATABASE_URL not set in env.');
  console.log('Please add SUPABASE_DB_PASSWORD="your-db-password" or DATABASE_URL to .env.local');
  process.exit(1);
}

async function checkObjects() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('✅ Connected to database!');

    // 1. Extensions
    const extRes = await client.query(`
      SELECT extname FROM pg_extension;
    `);
    console.log('\n=== Extensions ===');
    console.log(extRes.rows.map(r => r.extname).join(', '));

    // 2. Views
    const viewsRes = await client.query(`
      SELECT table_name FROM information_schema.views 
      WHERE table_schema = 'public';
    `);
    console.log('\n=== Views ===');
    console.log(viewsRes.rows.map(r => r.table_name).join(', '));

    // 3. Custom Functions
    const funcRes = await client.query(`
      SELECT p.proname, pg_get_functiondef(p.oid) as def
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.prokind = 'f';
    `);
    console.log('\n=== Custom Functions ===');
    funcRes.rows.forEach(r => {
      console.log(`- Function: ${r.proname}`);
    });

    // 4. Triggers
    const trigRes = await client.query(`
      SELECT tgname, tgenabled, pg_get_triggerdef(t.oid) as def
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE n.nspname = 'public'
      AND NOT tgisinternal;
    `);
    console.log('\n=== Triggers ===');
    trigRes.rows.forEach(r => {
      console.log(`- Trigger: ${r.tgname} (${r.def})`);
    });

    // 5. RLS Policies
    const polRes = await client.query(`
      SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public';
    `);
    console.log('\n=== RLS Policies ===');
    polRes.rows.forEach(r => {
      console.log(`- Policy on ${r.tablename}: ${r.policyname} (${r.cmd})`);
    });

  } catch (err) {
    console.error('❌ Error checking database objects:', err.message);
  } finally {
    await client.end();
  }
}

checkObjects();
