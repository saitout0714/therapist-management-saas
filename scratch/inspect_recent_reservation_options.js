const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;

  const supabase = createClient(url, key);

  console.log("=== RESERVATIONS WITH OPTIONS ===");
  // 最近の予約（オプションがあるもの）を検索
  const { data: resOptions, error: err } = await supabase
    .from('reservation_options')
    .select(`
      reservation_id,
      option_id,
      price,
      options (name, back_category, back_amount),
      reservations!inner (
        id,
        date,
        designation_type,
        therapist_id,
        therapists:therapists!reservations_therapist_id_fkey (name),
        therapist_back_amount,
        shop_revenue,
        shops (name)
      )
    `)
    .order('reservation_id', { ascending: false })
    .limit(10);

  if (err) {
    console.error(err);
  } else {
    console.log(resOptions.map(ro => ({
      reservation_id: ro.reservation_id,
      shop_name: ro.reservations?.shops?.name,
      date: ro.reservations?.date,
      therapist_name: ro.reservations?.therapists?.name,
      designation_type: ro.reservations?.designation_type,
      option_name: ro.options?.name,
      option_category: ro.options?.back_category,
      option_price: ro.price,
      option_default_back: ro.options?.back_amount,
      therapist_total_back: ro.reservations?.therapist_back_amount
    })));
  }
}

main();
