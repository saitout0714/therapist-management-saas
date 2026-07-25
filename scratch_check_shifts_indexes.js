const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkShiftsConstraints() {
  const { data, error } = await supabase.rpc('pg_indexes', {});
  console.log("pg_indexes:", data || error);

  // 直接 query を投げて shifts の制約を確認
  const { data: constraints, error: cErr } = await supabase.from('shifts').select('id').limit(1);
  console.log("Shifts sample:", constraints, cErr);
}

checkShiftsConstraints();
