const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function mergeAyaseLunaPair() {
  const masterId = 'a4ab6c75-2f5f-4d06-ac7a-ce2cf5c36b3a'; // Ayase Luna（アヤセ ルナ） (バカラ宇部)
  const dupId = '86442ddc-5fdb-4b8f-9910-a1ac1ed54cfe';    // Ayase Runa（アヤセ　ルナ） (バカラ山口湯田)

  console.log("=== アヤセ ルナ（Luna / Runa）の統合処理を開始 ===");

  // 1. therapist_shops にバカラ宇部とバカラ山口湯田の出勤店舗を登録
  await supabase.from('therapist_shops').upsert({ therapist_id: masterId, shop_id: '11013a02-86fe-4675-83e2-9e11f459d416' }, { onConflict: 'therapist_id,shop_id' });
  await supabase.from('therapist_shops').upsert({ therapist_id: masterId, shop_id: '508def9b-cd72-439d-9bbc-2dbe5e3a8af4', alias_name: 'Ayase Runa（アヤセ　ルナ）' }, { onConflict: 'therapist_id,shop_id' });

  // 2. シフト・予約・写真・メモ・NGデータの付け替え
  await supabase.from('shifts').update({ therapist_id: masterId }).eq('therapist_id', dupId);
  await supabase.from('reservations').update({ therapist_id: masterId }).eq('therapist_id', dupId);
  await supabase.from('therapist_photos').update({ therapist_id: masterId }).eq('therapist_id', dupId);
  await supabase.from('therapist_memos').update({ therapist_id: masterId }).eq('therapist_id', dupId);
  await supabase.from('customer_therapist_ng').update({ therapist_id: masterId }).eq('therapist_id', dupId);
  await supabase.from('sync_jobs').update({ therapist_id: masterId }).eq('therapist_id', dupId);

  // 3. 重複レコードの削除
  const { error } = await supabase.from('therapists').delete().eq('id', dupId);
  if (error) {
    console.error("削除エラー:", error.message);
  } else {
    console.log("=== アヤセ ルナ（Luna / Runa）の統合が完了しました！ ===");
  }
}

mergeAyaseLunaPair();
