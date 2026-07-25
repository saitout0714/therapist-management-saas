const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// 電話番号から末尾4桁を取り出す
function getPhoneLast4(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 4) {
    return digits.substring(digits.length - 4);
  }
  return '';
}

async function appendPhone4ToCustomerNames() {
  console.log("=== 顧客名を『お名前+電話下4桁数字』形式に一括更新開始 ===");

  const { data: owner } = await supabase.from('owners').select('id').ilike('name', '%バカラ%').single();
  const { data: baccaratShops } = await supabase.from('shops').select('id').eq('owner_id', owner.id);
  const shopIds = baccaratShops.map(s => s.id);

  let hasMore = true;
  let page = 0;
  const pageSize = 1000;

  let updatedCount = 0;

  while (hasMore) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, phone')
      .in('shop_id', shopIds)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (!customers || customers.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`ページ ${page + 1}: ${customers.length} 件処理中...`);

    for (const c of customers) {
      const last4 = getPhoneLast4(c.phone);
      if (!last4) continue;

      let currentName = c.name ? c.name.trim() : 'お客様';

      // 既に名前に末尾4桁数字が含まれているか判定
      if (!currentName.endsWith(last4) && !/\d{4}$/.test(currentName)) {
        const newName = `${currentName}${last4}`;
        await supabase
          .from('customers')
          .update({ name: newName })
          .eq('id', c.id);
        updatedCount++;
      }
    }

    if (customers.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }

  console.log(`\n=== 顧客名更新完了 ===`);
  console.log(`『お名前+電話下4桁数字』に一括変更した件数: ${updatedCount} 件`);
}

appendPhone4ToCustomerNames();
