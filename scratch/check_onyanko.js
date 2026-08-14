const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: shops, error: shopErr } = await supabase
    .from('shops')
    .select('*')
    .or('slug.eq.onyankospa,name.ilike.%おニャンこ%');
  
  console.log('Shops:', JSON.stringify(shops, null, 2));
  if (shopErr) console.error('Shop error:', shopErr);

  if (shops && shops.length > 0) {
    const shopId = shops[0].id;
    console.log('Shop ID:', shopId);

    const { data: courses } = await supabase.from('courses').select('*').eq('shop_id', shopId);
    console.log('Courses:', JSON.stringify(courses, null, 2));

    const { data: options } = await supabase.from('options').select('*').eq('shop_id', shopId);
    console.log('Options:', JSON.stringify(options, null, 2));

    const { data: rooms } = await supabase.from('rooms').select('*').eq('shop_id', shopId);
    console.log('Rooms:', JSON.stringify(rooms, null, 2));

    const { data: designationTypes } = await supabase.from('designation_types').select('*').eq('shop_id', shopId);
    console.log('Designation Types:', JSON.stringify(designationTypes, null, 2));

    const { data: shopSettings } = await supabase.from('shop_settings').select('*').eq('shop_id', shopId);
    console.log('Shop Settings:', JSON.stringify(shopSettings, null, 2));
  }
}

main();
