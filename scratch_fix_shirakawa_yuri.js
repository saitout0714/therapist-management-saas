const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixShirakawaYuri() {
  console.log("=== Shirakawa Yuri 修復・正確な統合開始 ===");

  const { data: yudaShop } = await supabase.from('shops').select('id').eq('name', 'バカラ山口湯田').single();
  const { data: shunanShop } = await supabase.from('shops').select('id').eq('name', 'バカラ周南下松').single();
  const { data: iwakuniShop } = await supabase.from('shops').select('id').eq('name', 'バカラ岩国').single();

  // 1. Shirakawa Yuri マスターを作成
  const { data: created, error } = await supabase
    .from('therapists')
    .insert([{
      name: 'Shirakawa Yuri（シラカワ ユリ）',
      shop_id: yudaShop.id,
      is_active: true
    }])
    .select('id');

  if (error || !created || created.length === 0) {
    console.error("作成エラー:", error);
    return;
  }
  const masterId = created[0].id;
  console.log("新規作成 Shirakawa Yuri ID:", masterId);

  // 2. 出勤店舗をバカラ山口湯田・周南下松・岩国に登録
  await supabase.from('therapist_shops').upsert({ therapist_id: masterId, shop_id: yudaShop.id }, { onConflict: 'therapist_id,shop_id' });
  await supabase.from('therapist_shops').upsert({ therapist_id: masterId, shop_id: shunanShop.id }, { onConflict: 'therapist_id,shop_id' });
  await supabase.from('therapist_shops').upsert({ therapist_id: masterId, shop_id: iwakuniShop.id, alias_name: 'Shirakawa Yuri（白河 百合）' }, { onConflict: 'therapist_id,shop_id' });

  // 3. 白川めい (8b6d56d6-5244-41e6-84ac-e71494ea769d) の不要なバカラ紐付けを解除
  await supabase.from('therapist_shops').delete().eq('therapist_id', '8b6d56d6-5244-41e6-84ac-e71494ea769d').in('shop_id', [yudaShop.id, shunanShop.id, iwakuniShop.id]);

  console.log("=== Shirakawa Yuri 修復・正確な統合完了 ===");
}

fixShirakawaYuri();
