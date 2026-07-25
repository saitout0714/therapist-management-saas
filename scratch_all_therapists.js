const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function simpleFind() {
  const { data, error } = await supabase.from('therapists').select('id, name, shop_id');
  if (error) {
    console.error("エラー:", error);
    return;
  }
  console.log("全件数:", data.length);
  
  // 名前の一部で検索
  data.forEach(t => {
    if (t.name.includes('ノガミ') || t.name.includes('Nogami') || t.name.includes('コウ') || t.name.includes('Kou')) {
      console.log("発見:", t);
    }
  });
}

simpleFind();
