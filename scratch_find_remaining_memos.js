const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findRemainingMemos() {
  console.log("=== 全テーブル内の memo 非空レコード検索 ===");

  const { data, error } = await supabase
    .from('customers')
    .select('id, name, memo, shop_id')
    .not('memo', 'is', null)
    .limit(50);

  if (error) {
    console.error("エラー:", error);
    return;
  }

  console.log(`非空 memo 件数: ${data.length}`);
  data.forEach((c, i) => {
    console.log(`${i + 1}. ID: ${c.id} / 名前: "${c.name}" / memo: "${c.memo}" / shop_id: ${c.shop_id}`);
  });
}

findRemainingMemos();
