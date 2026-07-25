const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

function normPhone(p) {
  if (!p) return '';
  let raw = p.replace(/\D/g, '');
  if (raw.startsWith('81') && raw.length > 10) {
    raw = '0' + raw.substring(2);
  }
  return raw;
}

async function cleanTruePhoneDuplicates() {
  console.log("=== DB内の同一電話番号重複レコード統合開始 ===");

  const { data: owner } = await supabase.from('owners').select('id').ilike('name', '%バカラ%').single();
  const { data: baccaratShops } = await supabase.from('shops').select('id').eq('owner_id', owner.id);
  const shopIds = baccaratShops.map(s => s.id);

  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone, shop_id, memo, created_at')
    .in('shop_id', shopIds);

  const phoneMap = new Map();
  (customers || []).forEach(c => {
    const cleanP = normPhone(c.phone);
    if (!cleanP) return;
    const list = phoneMap.get(cleanP) || [];
    list.push(c);
    phoneMap.set(cleanP, list);
  });

  let mergedGroups = 0;

  for (const [phone, list] of phoneMap.entries()) {
    if (list.length > 1) {
      console.log(`\n【統合処理中】 電話番号: ${phone} (${list.length}件)`);
      // 最古のものをマスターとする
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const master = list[0];
      const dups = list.slice(1);

      for (const dup of dups) {
        if (dup.id === master.id) continue;
        console.log(`  - 重複ID: ${dup.id} (${dup.name}) を マスターID: ${master.id} (${master.name}) に統合`);

        // 予約の付け替え
        await supabase.from('reservations').update({ customer_id: master.id }).eq('customer_id', dup.id);

        // 重複顧客削除
        await supabase.from('customers').delete().eq('id', dup.id);
      }
      mergedGroups++;
    }
  }

  console.log(`\n=== 重複統合完了: ${mergedGroups} グループ統合 ===`);
}

cleanTruePhoneDuplicates();
