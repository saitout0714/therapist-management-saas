const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findAndMergeUmeda() {
  console.log("=== Umeda Ruru 検索・統合開始 ===");

  const { data: list, error } = await supabase
    .from('therapists')
    .select('id, name, shop_id, created_at, shops!therapists_shop_id_fkey(name)');

  if (error || !list) {
    console.error("検索エラー:", error);
    return;
  }

  const matched = list.filter(t => 
    t.name.toLowerCase().includes('umeda') || 
    t.name.includes('ウメダ') || 
    t.name.includes('梅田')
  );

  console.log("検出件数:", matched.length);
  matched.forEach(t => {
    console.log(`- ID: ${t.id} / 名前: "${t.name}" / 店舗: ${t.shops?.name || t.shop_id} / 作成日: ${t.created_at}`);
  });

  if (matched.length <= 1) {
    console.log("統合対象となる重複レコードが見つかりませんでした。");
    return;
  }

  // 最古のものをマスターとする
  matched.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const master = matched[0];
  const dups = matched.slice(1);

  console.log(`\n【マスターとして残すレコード】 ID: ${master.id} / 名前: "${master.name}"`);

  if (master.shop_id) {
    await supabase.from('therapist_shops').upsert({ therapist_id: master.id, shop_id: master.shop_id }, { onConflict: 'therapist_id,shop_id' });
  }

  for (const dup of dups) {
    console.log(`  - 重複レコード ID: ${dup.id} ("${dup.name}") をマスターに統合します...`);

    if (dup.shop_id) {
      await supabase.from('therapist_shops').upsert({
        therapist_id: master.id,
        shop_id: dup.shop_id,
        alias_name: dup.name !== master.name ? dup.name : null
      }, { onConflict: 'therapist_id,shop_id' });
    }

    await supabase.from('shifts').update({ therapist_id: master.id }).eq('therapist_id', dup.id);
    await supabase.from('reservations').update({ therapist_id: master.id }).eq('therapist_id', dup.id);
    await supabase.from('therapist_photos').update({ therapist_id: master.id }).eq('therapist_id', dup.id);
    await supabase.from('therapist_memos').update({ therapist_id: master.id }).eq('therapist_id', dup.id);
    await supabase.from('customer_therapist_ng').update({ therapist_id: master.id }).eq('therapist_id', dup.id);
    await supabase.from('sync_jobs').update({ therapist_id: master.id }).eq('therapist_id', dup.id);

    const { error: delError } = await supabase.from('therapists').delete().eq('id', dup.id);
    if (delError) {
      console.error(`  - 重複削除エラー:`, delError.message);
    } else {
      console.log(`  - 重複レコード ${dup.id} 統合削除完了`);
    }
  }

  console.log("\n=== Umeda Ruru 統合完了 ===");
}

findAndMergeUmeda();
