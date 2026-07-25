const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findAndMergeAyaseluna() {
  console.log("=== アヤセルナ 検索開始 ===");

  const { data: list, error } = await supabase
    .from('therapists')
    .select('id, name, shop_id, created_at, shops!therapists_shop_id_fkey(name)')
    .or('name.ilike.%アヤセルナ%,name.ilike.%あやせるな%,name.ilike.%Ayaseluna%,name.ilike.%ayaseluna%,name.ilike.%Ayase Luna%');

  if (error || !list) {
    console.error("検索エラー:", error);
    return;
  }

  console.log("検出件数:", list.length);
  list.forEach(t => {
    console.log(`- ID: ${t.id} / 名前: "${t.name}" / 店舗: ${t.shops?.name || t.shop_id} / 作成日: ${t.created_at}`);
  });

  if (list.length <= 1) {
    console.log("統合対象となる重複レコードが見つかりませんでした。");
    return;
  }

  // 最古のものをマスターとする
  list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const master = list[0];
  const dups = list.slice(1);

  console.log(`\n【マスターとして残すレコード】 ID: ${master.id} / 名前: "${master.name}"`);

  // マスターの shop_id を therapist_shops に登録
  if (master.shop_id) {
    await supabase.from('therapist_shops').upsert({ therapist_id: master.id, shop_id: master.shop_id }, { onConflict: 'therapist_id,shop_id' });
  }

  for (const dup of dups) {
    console.log(`  - 重複レコード ID: ${dup.id} ("${dup.name}") をマスターに統合します...`);

    // 店舗出勤の登録
    if (dup.shop_id) {
      await supabase.from('therapist_shops').upsert({
        therapist_id: master.id,
        shop_id: dup.shop_id,
        alias_name: dup.name !== master.name ? dup.name : null
      }, { onConflict: 'therapist_id,shop_id' });
    }

    // 各関連データの付け替え
    await supabase.from('shifts').update({ therapist_id: master.id }).eq('therapist_id', dup.id);
    await supabase.from('reservations').update({ therapist_id: master.id }).eq('therapist_id', dup.id);
    await supabase.from('therapist_photos').update({ therapist_id: master.id }).eq('therapist_id', dup.id);
    await supabase.from('therapist_memos').update({ therapist_id: master.id }).eq('therapist_id', dup.id);
    await supabase.from('customer_therapist_ng').update({ therapist_id: master.id }).eq('therapist_id', dup.id);
    await supabase.from('sync_jobs').update({ therapist_id: master.id }).eq('therapist_id', dup.id);

    // 重複レコード削除
    const { error: delError } = await supabase.from('therapists').delete().eq('id', dup.id);
    if (delError) {
      console.error(`  - 重複レコード削除エラー:`, delError.message);
    } else {
      console.log(`  - 重複レコード ${dup.id} 統合削除完了`);
    }
  }

  console.log("\n=== アヤセルナ 統合完了 ===");
}

findAndMergeAyaseluna();
