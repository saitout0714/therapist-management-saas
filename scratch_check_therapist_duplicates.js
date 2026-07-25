const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTherapistDuplicates() {
  // バカラグループの owner_id を取得
  const { data: owner } = await supabase.from('owners').select('id').eq('code', 'baccarat_group').single();
  if (!owner) {
    console.log("バカラグループが見つかりません");
    return;
  }

  // バカラグループに属する店舗を取得
  const { data: shops } = await supabase.from('shops').select('id, name').eq('owner_id', owner.id);
  const shopIds = (shops || []).map(s => s.id);
  console.log("バカラ店舗数:", shops?.length);

  // バカラ店舗のセラピストを取得
  const { data: therapists } = await supabase.from('therapists').select('id, name, shop_id, is_active').in('shop_id', shopIds);

  const shopMap = new Map((shops || []).map(s => [s.id, s.name]));
  const nameMap = new Map();

  (therapists || []).forEach(t => {
    const list = nameMap.get(t.name) || [];
    list.push({ ...t, shop_name: shopMap.get(t.shop_id) });
    nameMap.set(t.name, list);
  });

  console.log("--- 同名で重複しているセラピスト一覧 ---");
  let duplicateCount = 0;
  nameMap.forEach((list, name) => {
    if (list.length > 1) {
      duplicateCount++;
      console.log(`\n【${name}】 (${list.length}店舗に存在):`);
      list.forEach(t => {
        console.log(`  - 店舗: ${t.shop_name} (ID: ${t.id})`);
      });
    }
  });

  if (duplicateCount === 0) {
    console.log("完全同名のセラピストは見つかりませんでした。");
  }
}

checkTherapistDuplicates();
