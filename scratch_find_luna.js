const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findLuna() {
  const { data } = await supabase.from('therapists').select('id, name, shop_id, shops!therapists_shop_id_fkey(name)');
  const matched = (data || []).filter(t => 
    t.name.includes('ルナ') || 
    t.name.includes('Luna') || 
    t.name.includes('luna') || 
    t.name.includes('アヤセ') ||
    t.name.includes('Ayase')
  );
  console.log("「ルナ/Luna/アヤセ」検索結果:");
  matched.forEach(t => {
    console.log(`- ID: ${t.id} / 名前: "${t.name}" / 店舗: ${t.shops?.name || t.shop_id}`);
  });
}

findLuna();
