const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function searchKou() {
  const { data: baccaratOwner } = await supabase.from('owners').select('id').eq('code', 'baccarat_group').single();
  const { data: shops } = await supabase.from('shops').select('id, name').eq('owner_id', baccaratOwner.id);
  const shopIds = (shops || []).map(s => s.id);

  const { data: therapists } = await supabase.from('therapists').select('id, name, shop_id, shops(name)').in('shop_id', shopIds);
  console.log("バカラ全セラピスト数:", therapists?.length);

  const kouList = (therapists || []).filter(t => t.name.includes('コウ') || t.name.includes('Kou') || t.name.includes('こう') || t.name.includes('Nogami') || t.name.includes('nogami'));
  console.log("「コウ/Nogami」関連:", kouList);
}

searchKou();
