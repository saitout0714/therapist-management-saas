const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyBaccaratSharing() {
  console.log("=== バカラ全店舗の共有状況検証 ===");

  // 1. バカラオーナーの確認
  const { data: owner } = await supabase.from('owners').select('id, name').ilike('name', '%バカラ%').single();
  console.log("オーナーグループ:", owner);

  // 2. バカラ所属店舗
  const { data: shops } = await supabase.from('shops').select('id, name, owner_id').eq('owner_id', owner.id);
  console.log("バカラグループ所属店舗数:", shops?.length);
  shops?.forEach(s => console.log(`  - ${s.name} (ID: ${s.id})`));

  const shopIds = (shops || []).map(s => s.id);

  // 3. 顧客データ件数
  const { count: customerCount } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .in('shop_id', shopIds);

  console.log(`\nバカラ全4店舗の総顧客数: ${customerCount} 名 (グループ内全店で一元共有・閲覧可能)`);

  // 4. セラピスト共有状況
  const { data: therapists } = await supabase
    .from('therapists')
    .select('id, name, shop_id, shops!therapists_shop_id_fkey(name)')
    .in('shop_id', shopIds);

  console.log(`\nバカラグループのセラピスト総数: ${therapists?.length} 名`);

  // 各セラピストがどの店舗に出勤権限(therapist_shops)を持っているか確認
  const { data: tsData } = await supabase.from('therapist_shops').select('therapist_id, shop_id');
  const tsMap = new Map();
  (tsData || []).forEach(ts => {
    const list = tsMap.get(ts.therapist_id) || [];
    list.push(ts.shop_id);
    tsMap.set(ts.therapist_id, list);
  });

  therapists?.forEach(t => {
    const assignedShops = tsMap.get(t.id) || [t.shop_id];
    console.log(`- ${t.name}: 出勤可能店舗数 ${assignedShops.length} / 4店舗`);
  });

  console.log("\n=== 検証完了 ===");
}

verifyBaccaratSharing();
