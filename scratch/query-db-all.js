const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const dbUrl = 'https://pumkniqtgjsotsxhyvbq.supabase.co';
const dbKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bWtuaXF0Z2pzb3RzeGh5dmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQ3Njc4NiwiZXhwIjoyMDgyMDUyNzg2fQ.gmR589RW_NT3wdOsmr5TuqEVXXG_bHwry7Ge8DCH_24';
const supabase = createClient(dbUrl, dbKey);

async function run() {
  const { data: shops, error: shopErr } = await supabase
    .from('shops')
    .select('id, name')
    .ilike('name', '%カレッツァ%');
  
  if (shopErr || !shops || shops.length === 0) {
    console.error('Shop not found or error:', shopErr);
    return;
  }
  
  const shop = shops[0];
  console.log('Found shop:', shop);

  const { data: rooms, error: rErr } = await supabase
    .from('rooms')
    .select('id, name')
    .eq('shop_id', shop.id);
  if (rErr) {
    console.error('Error fetching rooms:', rErr);
  } else {
    console.log('Rooms:', rooms);
  }

  const { data: therapists, error: tErr } = await supabase
    .from('therapists')
    .select('*')
    .eq('shop_id', shop.id)
    .limit(1);

  if (tErr) {
    console.error('Error fetching therapists:', tErr);
    return;
  }

  console.log(`Found ${therapists.length} therapists:`);
  console.log(`Therapist columns:`, Object.keys(therapists[0] || {}));
}

run();
