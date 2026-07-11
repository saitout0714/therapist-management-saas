const { createClient } = require('@supabase/supabase-js');

const dbUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const dbKey = 'sb_publishable_PVxVPbhBIRoEOe1IyRx4zA_ofK5vaar';
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
    .eq('date', '2026-07-02');

  if (error) {
    console.error('Error fetching shifts:', error);
    return;
  }

  console.log(`Found ${shifts.length} shifts for July 2nd in production Carezza:`);
  console.log(JSON.stringify(shifts, null, 2));
}

run();
