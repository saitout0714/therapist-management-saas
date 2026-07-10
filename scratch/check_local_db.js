const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/Users/saitou-cyberpunk/Desktop/yoyakukanri/therapist-management-saas/.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/ANON_KEY is missing');
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  console.log('Connecting to:', url);
  
  // 1. shop_reservation_codes の確認
  const { data: codes, error: codesError } = await supabase
    .from('shop_reservation_codes')
    .select('code, shop_id, is_active');
    
  if (codesError) {
    console.error('Error fetching shop_reservation_codes:', codesError);
  } else {
    console.log('Shop Reservation Codes:', codes);
  }

  // 2. shops の確認
  const { data: shops, error: shopsError } = await supabase
    .from('shops')
    .select('id, name, short_name');
    
  if (shopsError) {
    console.error('Error fetching shops:', shopsError);
  } else {
    console.log('Shops:', shops);
  }
}

run();
