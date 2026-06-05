const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(projectUrl, serviceRoleKey);

async function main() {
  console.log('Adding credit_payment_url column to system_settings table...');

  const sql = `
    ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS credit_payment_url TEXT;
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql: sql });
  if (error) {
    console.error('Migration failed:', error);
  } else {
    console.log('Migration completed successfully!', data);
  }
}

main().catch(console.error);
