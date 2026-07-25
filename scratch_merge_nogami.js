const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function mergeNogami() {
  const masterId = '1e41ec29-ec3d-48aa-b061-60a633c294a9'; // Nogami Kou（ノガミ コウ）
  const dupId = '91c96ef2-8cb1-4347-b384-6544eb7ea6c2';    // Nogami Kou（ノガミ コウ）ビジュ万博

  console.log("=== ノガミ コウ の統合を開始 ===");

  // 1. therapist_shops 紐付け
  await supabase.from('therapist_shops').upsert({ therapist_id: masterId, shop_id: 'e6b1cc21-c9eb-4fc1-888d-6f965a90c1df' }, { onConflict: 'therapist_id,shop_id' });
  await supabase.from('therapist_shops').upsert({ therapist_id: masterId, shop_id: '508def9b-cd72-439d-9bbc-2dbe5e3a8af4', alias_name: 'Nogami Kou（ノガミ コウ）ビジュ万博' }, { onConflict: 'therapist_id,shop_id' });

  // 2. 他テーブルの参照更新
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
    console.log("=== ノガミ コウ の統合完了 ===");
  }
}

mergeNogami();
