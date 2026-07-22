const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function clearBaccaratComments() {
  // 1. Find all Baccarat shops
  const { data: shops, error: shopsError } = await supabase
    .from('shops')
    .select('id, name')
    .ilike('name', '%バカラ%');

  if (shopsError) {
    console.error('Error fetching Baccarat shops:', shopsError);
    return;
  }

  console.log('Target Baccarat shops:', shops);
  const shopIds = shops.map(s => s.id);

  if (shopIds.length === 0) {
    console.log('No Baccarat shops found.');
    return;
  }

  // 2. Fetch therapists count in these shops
  const { data: therapists, error: fetchError } = await supabase
    .from('therapists')
    .select('id, name, shop_id, comment, staff_memo')
    .in('shop_id', shopIds);

  if (fetchError) {
    console.error('Error fetching therapists:', fetchError);
    return;
  }

  console.log(`Found ${therapists.length} therapists across Baccarat stores.`);

  // 3. Clear comment (and staff_memo) for all therapists in these shops
  const { error: updateError } = await supabase
    .from('therapists')
    .update({ comment: null, staff_memo: null })
    .in('shop_id', shopIds);

  if (updateError) {
    console.error('Error clearing comments:', updateError);
  } else {
    console.log(`✅ Successfully cleared comments and staff memos for all ${therapists.length} therapists in Baccarat stores!`);
  }
}

clearBaccaratComments();
