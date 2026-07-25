const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function organizeOwners() {
  console.log("=== オーナーグループの正常整理スクリプト開始 ===");

  // 1. バカラグループオーナーの作成
  let { data: baccaratOwner } = await supabase
    .from('owners')
    .select('id')
    .eq('code', 'baccarat_group')
    .single();

  if (!baccaratOwner) {
    const { data: created } = await supabase
      .from('owners')
      .insert([{ name: 'バカラグループ', code: 'baccarat_group', plan_type: 'standard' }])
      .select('id')
      .single();
    baccaratOwner = created;
  }

  // 2. 秘密妻・アーバンスパグループオーナーの作成
  let { data: secretOwner } = await supabase
    .from('owners')
    .select('id')
    .eq('code', 'secret_urban_group')
    .single();

  if (!secretOwner) {
    const { data: created } = await supabase
      .from('owners')
      .insert([{ name: '秘密妻・アーバンスパグループ', code: 'secret_urban_group', plan_type: 'standard' }])
      .select('id')
      .single();
    secretOwner = created;
  }

  // 3. バカラ4店舗に baccaratOwner の id を割り当て
  const baccaratShops = ['バカラ山口湯田', 'バカラ周南下松', 'バカラ宇部', 'バカラ岩国'];
  for (const shopName of baccaratShops) {
    const { data } = await supabase.from('shops').update({ owner_id: baccaratOwner.id }).eq('name', shopName).select('name');
    console.log(`[バカラグループ割り当て] ${shopName}:`, data ? 'OK' : 'エラー');
  }

  // 4. 新宿秘密妻・アーバンスパに secretOwner の id を割り当て
  const secretShops = ['新宿秘密妻', 'アーバンスパ'];
  for (const shopName of secretShops) {
    const { data } = await supabase.from('shops').update({ owner_id: secretOwner.id }).eq('name', shopName).select('name');
    console.log(`[秘密妻グループ割り当て] ${shopName}:`, data ? 'OK' : 'エラー');
  }

  // 5. その他の単独店舗には、それぞれ個別オーナーを作成して割り当て（混ざらないように分離）
  const { data: allShops } = await supabase.from('shops').select('id, name, owner_id');
  for (const shop of allShops) {
    if (!baccaratShops.includes(shop.name) && !secretShops.includes(shop.name)) {
      // 個別オーナーの作成
      const code = `single_${shop.id.substring(0, 8)}`;
      let { data: singleOwner } = await supabase.from('owners').select('id').eq('code', code).single();
      if (!singleOwner) {
        const { data: created } = await supabase.from('owners').insert([{ name: shop.name, code: code }]).select('id').single();
        singleOwner = created;
      }
      if (singleOwner) {
        await supabase.from('shops').update({ owner_id: singleOwner.id }).eq('id', shop.id);
        console.log(`[個別オーナー分離] ${shop.name}`);
      }
    }
  }

  // 6. users の owner_id を shop_owners に従って更新
  const { data: shopOwners } = await supabase.from('shop_owners').select('user_id, shop_id, shops(owner_id)');
  if (shopOwners) {
    for (const so of shopOwners) {
      if (so.shops && so.shops.owner_id) {
        await supabase.from('users').update({ owner_id: so.shops.owner_id }).eq('id', so.user_id);
      }
    }
  }

  console.log("=== オーナーグループの正常整理スクリプト完了 ===");
}

organizeOwners();
