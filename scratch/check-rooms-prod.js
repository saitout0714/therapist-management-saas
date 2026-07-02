const { createClient } = require('@supabase/supabase-js');

const dbUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const dbKey = 'sb_publishable_PVxVPbhBIRoEOe1IyRx4zA_ofK5vaar';
const supabase = createClient(dbUrl, dbKey);

async function run() {
  const shopId = '75e69a2a-eaac-4d2f-91af-e7579c1a84ab';
  
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select('id, name')
    .eq('shop_id', shopId);

  if (error) {
    console.error('Error fetching rooms:', error);
    return;
  }

  console.log(`Found ${rooms.length} rooms in production Carezza:`, rooms);
}

run();
