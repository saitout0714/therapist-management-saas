const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// 電話番号の正規化 (数字のみ抽出)
function normPhone(p) {
  if (!p) return '';
  let raw = p.replace(/\D/g, '');
  if (raw.startsWith('81') && raw.length > 10) {
    raw = '0' + raw.substring(2);
  }
  return raw;
}

async function auditPhoneDuplicates() {
  console.log("=== 全顧客データベースの電話番号重複監査開始 ===");

  const { data: owner } = await supabase.from('owners').select('id').ilike('name', '%バカラ%').single();
  const { data: baccaratShops } = await supabase.from('shops').select('id').eq('owner_id', owner.id);
  const shopIds = baccaratShops.map(s => s.id);

  let hasMore = true;
  let page = 0;
  const pageSize = 1000;

  const allCustomers = [];

  while (hasMore) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, phone, shop_id, created_at, memo')
      .in('shop_id', shopIds)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (!customers || customers.length === 0) {
      hasMore = false;
      break;
    }

    allCustomers.push(...customers);

    if (customers.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }

  console.log(`バカラグループ総顧客数: ${allCustomers.length} 名`);

  // 電話番号でのグループ化
  const phoneMap = new Map();
  for (const c of allCustomers) {
    const cleanP = normPhone(c.phone);
    if (!cleanP || cleanP.length < 10) continue;

    const list = phoneMap.get(cleanP) || [];
    list.push(c);
    phoneMap.set(cleanP, list);
  }

  let duplicatePhoneGroups = 0;
  let totalDuplicateRecords = 0;

  phoneMap.forEach((list, phone) => {
    if (list.length > 1) {
      duplicatePhoneGroups++;
      totalDuplicateRecords += list.length;
      console.log(`\n【重複検出】 電話番号: ${phone} (件数: ${list.length})`);
      list.forEach(c => {
        console.log(`  - ID: ${c.id} / 名前: "${c.name}" / 表記電話: "${c.phone}" / 登録日: ${c.created_at}`);
      });
    }
  });

  console.log(`\n=== 監査完了 ===`);
  console.log(`重複電話番号グループ数: ${duplicatePhoneGroups} 件`);
  console.log(`全同一電話番号のレコード総数: ${totalDuplicateRecords} 件`);

  return { duplicatePhoneGroups, phoneMap };
}

auditPhoneDuplicates();
