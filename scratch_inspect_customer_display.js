const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectCustomerDisplay() {
  console.log("=== 顧客生データ表示チェック ===");

  const { data: owner } = await supabase.from('owners').select('id').ilike('name', '%バカラ%').single();
  const { data: baccaratShops } = await supabase.from('shops').select('id, name').eq('owner_id', owner.id);
  const shopIds = baccaratShops.map(s => s.id);

  // 一覧画面でフェッチされるクエリと同じものを実行
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone, memo, ng_reason, status, shop_id, owner_id')
    .in('shop_id', shopIds)
    .limit(20);

  console.log("フェッチ結果 サンプル20件:");
  customers?.forEach(c => {
    console.log(`- ID: ${c.id} / 名前: "${c.name}" / memo: "${c.memo}" / ng_reason: "${c.ng_reason}" / status: "${c.status}" / owner_id: "${c.owner_id}"`);
  });
}

inspectCustomerDisplay();
