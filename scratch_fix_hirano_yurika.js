const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixHiranoYurika() {
  console.log("=== ヒラノリン と 平野ゆりか の正確な分離・修復開始 ===");

  // 1. バカラグループの Hirano Rin（ヒラノ リン） マスターを作成/確認
  const { data: baccaratOwner } = await supabase.from('owners').select('id').eq('code', 'baccarat_group').single();
  const { data: yudaShop } = await supabase.from('shops').select('id').eq('name', 'バカラ山口湯田').single();
  const { data: shunanShop } = await supabase.from('shops').select('id').eq('name', 'バカラ周南下松').single();

  // Hirano Rin マスターを作成
  const { data: createdRin, error: createErr } = await supabase
    .from('therapists')
    .insert([{
      name: 'Hirano Rin（ヒラノ リン）',
      shop_id: yudaShop.id,
      is_active: true
    }])
    .select('id');

  if (createErr || !createdRin || createdRin.length === 0) {
    console.error("作成エラー:", createErr);
    return;
  }
  const masterRin = createdRin[0];
  console.log("新しく修復作成された Hirano Rin ID:", masterRin.id);

  // therapist_shops にバカラ山口湯田とバカラ周南下松を登録
  await supabase.from('therapist_shops').upsert({ therapist_id: masterRin.id, shop_id: yudaShop.id }, { onConflict: 'therapist_id,shop_id' });
  await supabase.from('therapist_shops').upsert({ therapist_id: masterRin.id, shop_id: shunanShop.id, alias_name: 'Hirani Rin（ヒラノ リン）' }, { onConflict: 'therapist_id,shop_id' });

  // 平野ゆりか (3aba60cc-e8c8-448d-b261-73654c23f8dc) に紐づいてしまっていた therapist_shops のうち、バカラのものを masterRin に移動し、平野ゆりかを元の状態に戻す
  await supabase.from('therapist_shops').delete().eq('therapist_id', '3aba60cc-e8c8-448d-b261-73654c23f8dc').in('shop_id', [yudaShop.id, shunanShop.id]);

  console.log("=== ヒラノリン と 平野ゆりか の正確な分離・修復完了 ===");
}

fixHiranoYurika();
