require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { calculateBack } = require('../lib/calculateBack');

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;

  const supabase = createClient(url, key);
  const reservationId = 'ffae82ca-223c-40d6-be02-8b4c3266a838';

  // 予約レコードを取得
  const { data: res, error: resErr } = await supabase
    .from('reservations')
    .select(`
      *,
      therapists:therapists!reservations_therapist_id_fkey (*),
      courses (*),
      reservation_options (*, options(*)),
      reservation_discounts (*)
    `)
    .eq('id', reservationId)
    .single();

  if (resErr || !res) {
    console.error("Error fetching reservation:", resErr);
    return;
  }

  const input = {
    shopId: res.shop_id,
    therapistId: res.therapist_id,
    therapistRankId: res.therapists?.rank_id || null,
    therapistBackCalcType: res.therapists?.back_calc_type || null,
    courseId: res.course_id,
    coursePrice: res.courses?.base_price || 0,
    courseBackAmount: res.courses?.back_amount || 0,
    courseDuration: res.courses?.duration || 0,
    designationType: res.designation_type,
    nominationFee: res.nomination_fee,
    extensionCount: res.extension_count || 0,
    options: res.reservation_options.map(o => ({
      option_id: o.option_id,
      price: o.price,
      custom_back_amount: o.custom_back_amount ?? undefined
    })),
    discounts: res.reservation_discounts.map(d => ({
      applied_amount: d.applied_amount,
      burden_type: d.burden_type,
      therapist_burden_amount: d.therapist_burden_amount
    })),
    date: res.date,
    startTime: res.start_time,
    himeBonus: res.is_hime ? (res.hime_bonus || 0) : 0,
    supabaseClient: supabase
  };

  const { supabaseClient, ...logInput } = input;
  console.log("=== BACK CALCULATION INPUT ===");
  console.log(JSON.stringify(logInput, null, 2));

  try {
    const result = await calculateBack(input);
    console.log("\n=== BACK CALCULATION RESULT ===");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error calculating back:", err);
  }
}

main();
