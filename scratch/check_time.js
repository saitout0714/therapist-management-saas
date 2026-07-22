const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: shifts } = await supabase.from('shifts').select('*').eq('date', '2026-07-27').eq('start_time', '24:30:00');
  console.log('Inserted shifts:', shifts);
}
run();
