const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const dbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(dbUrl, dbKey);

async function run() {
  // Find Carezza shop
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

  // Select therapists
  const { data: therapists, error: tErr } = await supabase
    .from('therapists')
    .select('id, name, hp_url, is_active')
    .eq('shop_id', shop.id)
    .order('order', { ascending: true, nullsFirst: false });

  if (tErr) {
    console.error('Error fetching therapists:', tErr);
    return;
  }

  console.log(`Found ${therapists.length} therapists:`);
  console.log(JSON.stringify(therapists, null, 2));
}

run();
