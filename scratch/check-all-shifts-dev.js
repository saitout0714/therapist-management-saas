const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(dbUrl, dbKey);

async function run() {
  const shopId = '75e69a2a-eaac-4d2f-91af-e7579c1a84ab';
  
  const { data: shifts, error } = await supabase
    .from('shifts')
    .select(`
      id,
      date,
      start_time,
      end_time,
      therapists(name)
    `)
    .eq('shop_id', shopId)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching shifts:', error);
    return;
  }

  console.log(`Found ${shifts.length} total shifts in development Carezza:`);
  console.log(JSON.stringify(shifts, null, 2));
}

run();
