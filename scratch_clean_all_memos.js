const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanAllCustomerMemos() {
  console.log("=== 全顧客メモの完全クリーンアップ開始 (全件取得) ===");

  let hasMore = true;
  let page = 0;
  const pageSize = 1000;

  let totalCleared = 0;
  let totalUpdated = 0;

  while (hasMore) {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, memo')
      .not('memo', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !customers || customers.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`ページ ${page + 1}: ${customers.length} 件取得`);

    for (const c of customers) {
      if (!c.memo) continue;

      // "検出店舗: ..." や " | 検出店舗: ..." を除去
      let cleaned = c.memo
        .replace(/\s*\|\s*検出店舗:\s*[^\|]+/g, '')
        .replace(/検出店舗:\s*[^\|]+/g, '')
        .trim();

      cleaned = cleaned.replace(/^\|+/, '').replace(/\|+$/, '').trim();

      if (cleaned !== c.memo) {
        const finalMemo = cleaned.length > 0 ? cleaned : null;
        await supabase
          .from('customers')
          .update({ memo: finalMemo })
          .eq('id', c.id);

        if (!finalMemo) totalCleared++;
        else totalUpdated++;
      }
    }

    if (customers.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }

  console.log(`\n=== 完全クリーンアップ完了 ===`);
  console.log(`「注意事項あり」をクリア（メモ空化）: ${totalCleared} 件`);
  console.log(`実際の特記事項のみを残して更新: ${totalUpdated} 件`);
}

cleanAllCustomerMemos();
