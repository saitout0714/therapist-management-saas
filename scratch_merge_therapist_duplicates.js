const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function mergeTherapistDuplicates() {
  console.log("=== 重複セラピスト自動統合スクリプト開始 ===");

  // 全オーナーの取得
  const { data: owners } = await supabase.from('owners').select('id, name');
  if (!owners) return;

  for (const owner of owners) {
    const { data: shops } = await supabase.from('shops').select('id, name').eq('owner_id', owner.id);
    if (!shops || shops.length === 0) continue;
    const shopIds = shops.map(s => s.id);

    const { data: therapists } = await supabase.from('therapists').select('id, name, shop_id, created_at').in('shop_id', shopIds).order('created_at', { ascending: true });
    if (!therapists) continue;

    const nameMap = new Map();
    therapists.forEach(t => {
      const list = nameMap.get(t.name) || [];
      list.push(t);
      nameMap.set(t.name, list);
    });

    for (const [name, list] of nameMap.entries()) {
      if (list.length > 1) {
        console.log(`\n【統合処理中】 オーナー: ${owner.name} / 対象セラピスト: ${name} (件数: ${list.length})`);
        
        const master = list[0]; // 最古のレコードをマスターとする
        const dups = list.slice(1);

        // マスター自身の shop_id を therapist_shops に挿入
        if (master.shop_id) {
          await supabase.from('therapist_shops').upsert({ therapist_id: master.id, shop_id: master.shop_id }, { onConflict: 'therapist_id,shop_id' });
        }

        for (const dup of dups) {
          console.log(`  - マスター (ID: ${master.id}) に 重複 (ID: ${dup.id}, 店舗: ${dup.shop_id}) を統合します...`);

          // 1. therapist_shops の紐付けを追加
          if (dup.shop_id) {
            await supabase.from('therapist_shops').upsert({ therapist_id: master.id, shop_id: dup.shop_id }, { onConflict: 'therapist_id,shop_id' });
          }

          // 2. shifts の付け替え
          await supabase.from('shifts').update({ therapist_id: master.id }).eq('therapist_id', dup.id);

          // 3. reservations の付け替え
          await supabase.from('reservations').update({ therapist_id: master.id }).eq('therapist_id', dup.id);

          // 4. therapist_photos の付け替え
          await supabase.from('therapist_photos').update({ therapist_id: master.id }).eq('therapist_id', dup.id);

          // 5. therapist_memos の付け替え
          await supabase.from('therapist_memos').update({ therapist_id: master.id }).eq('therapist_id', dup.id);

          // 6. customer_therapist_ng の付け替え
          await supabase.from('customer_therapist_ng').update({ therapist_id: master.id }).eq('therapist_id', dup.id);

          // 7. sync_jobs の付け替え
          await supabase.from('sync_jobs').update({ therapist_id: master.id }).eq('therapist_id', dup.id);

          // 8. 不要になった重複セラピストの削除
          const { error: delErr } = await supabase.from('therapists').delete().eq('id', dup.id);
          if (delErr) {
            console.error(`  - 重複削除エラー (ID: ${dup.id}):`, delErr.message);
          } else {
            console.log(`  - 重複レコード (ID: ${dup.id}) を統合削除完了`);
          }
        }
      }
    }
  }

  console.log("\n=== 重複セラピスト自動統合スクリプト完了 ===");
}

mergeTherapistDuplicates();
