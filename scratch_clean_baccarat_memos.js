const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanBaccaratMemos() {
  console.log("=== 顧客メモから『検出店舗』文字列の一括クリーンアップ開始 ===");

  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, memo')
    .not('memo', 'is', null);

  if (error || !customers) {
    console.error("顧客取得エラー:", error);
    return;
  }

  console.log(`対象顧客数: ${customers.length} 件`);

  let updatedCount = 0;
  let clearedCount = 0;

  for (const c of customers) {
    if (!c.memo) continue;

    // " | 検出店舗: ..." や "検出店舗: ..." を除去
    let cleaned = c.memo
      .replace(/\s*\|\s*検出店舗:\s*[^\|]+/g, '')
      .replace(/検出店舗:\s*[^\|]+/g, '')
      .trim();

    // 先頭や末尾に残った区切り文字 '|' を掃除
    cleaned = cleaned.replace(/^\|+/, '').replace(/\|+$/, '').trim();

    if (cleaned !== c.memo) {
      const finalMemo = cleaned.length > 0 ? cleaned : null;
      await supabase
        .from('customers')
        .update({ memo: finalMemo })
        .eq('id', c.id);

      if (!finalMemo) clearedCount++;
      else updatedCount++;
    }
  }

  console.log(`\n=== メモのクリーンアップ完了 ===`);
  console.log(`「注意事項あり」をクリア（メモ空化）: ${clearedCount} 件`);
  console.log(`実際の特記事項のみを残して更新: ${updatedCount} 件`);
}

cleanBaccaratMemos();
