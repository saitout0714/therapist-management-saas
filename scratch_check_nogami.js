const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNogami() {
  const { data } = await supabase.from('therapists').select('id, name, shop_id, shops(name)').ilike('name', '%ノガミ%');
  console.log("ノガミ検索結果:", data);
}

checkNogami();
