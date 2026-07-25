const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function perfectCleanMemos() {
  console.log("=== 顧客メモから『検出店舗』を完全100%消去開始 ===");

  let hasMore = true;
  let page = 0;
  const pageSize = 1000;

  let totalCleared = 0;
  let totalUpdated = 0;

  while (hasMore) {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, name, memo')
      .not('memo', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !customers || customers.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`ページ ${page + 1}: ${customers.length} 件取得`);

    for (const c of customers) {
      if (!c.memo || !c.memo.includes('検出店舗')) continue;

      // '|' で分割し、'検出店舗' を含む要素を完全削除
      const parts = c.memo.split('|');
      const cleanParts = parts
        .map(p => p.trim())
        .filter(p => p.length > 0 && !p.includes('検出店舗'));

      const finalMemo = cleanParts.length > 0 ? cleanParts.join(' | ') : null;

      await supabase
        .from('customers')
        .update({ memo: finalMemo })
        .eq('id', c.id);

      if (!finalMemo) totalCleared++;
      else totalUpdated++;
    }

    if (customers.length < pageSize) {
      hasMore = false;
    } else {
      page++;
    }
  }

  console.log(`\n=== 完全削除処理完了 ===`);
  console.log(`「注意事項あり」をクリア（メモ空化）: ${totalCleared} 件`);
  console.log(`実際の特記事項のみ残して更新: ${totalUpdated} 件`);
}

perfectCleanMemos();
