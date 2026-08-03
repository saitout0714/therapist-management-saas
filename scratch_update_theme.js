const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase Service Role Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function forceUpdateShopTheme() {
  const shopId = '150ee036-bd95-47ab-bf50-8132d3c62bdf';

  // 1. shops テーブルの取得
  const { data: shop, error: fetchErr } = await supabase.from('shops').select('*').eq('id', shopId).single();
  if (fetchErr) {
    console.error('Error fetching shop:', fetchErr);
    return;
  }

  console.log('Current Shop Data:', shop);

  // 2. theme_color と template_id の更新
  const { data: updated, error: updateErr } = await supabase
    .from('shops')
    .update({
      theme_color: '#ff6b8b',
      template_id: 'cute',
    })
    .eq('id', shopId)
    .select();

  if (updateErr) {
    console.error('Update failed:', updateErr.message);
    // もし template_id カラムがない場合は theme_color のみ保存
    const { data: retryData, error: retryErr } = await supabase
      .from('shops')
      .update({
        theme_color: '#ff6b8b',
      })
      .eq('id', shopId)
      .select();

    if (retryErr) {
      console.error('Retry failed:', retryErr.message);
    } else {
      console.log('Successfully updated theme_color:', retryData);
    }
  } else {
    console.log('Successfully updated both theme_color and template_id:', updated);
  }
}

forceUpdateShopTheme();
