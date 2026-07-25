const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function sampleNames() {
  const { data: owner } = await supabase.from('owners').select('id').ilike('name', '%バカラ%').single();
  const { data: baccaratShops } = await supabase.from('shops').select('id').eq('owner_id', owner.id);
  const shopIds = baccaratShops.map(s => s.id);

  const { data: customers } = await supabase
    .from('customers')
    .select('name, phone')
    .in('shop_id', shopIds)
    .limit(10);

  console.log("=== 修正後の顧客名サンプル (先頭10件) ===");
  customers?.forEach((c, i) => {
    console.log(`${i + 1}. 名前: "${c.name}" / 電話: "${c.phone}"`);
  });
}

sampleNames();
