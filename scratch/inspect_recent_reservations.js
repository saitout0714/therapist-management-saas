const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;

  const supabase = createClient(url, key);

  console.log("=== RECENT RESERVATIONS ===");
  const { data: res, error: resErr } = await supabase
    .from('reservations')
    .select(`
      id,
      date,
      start_time,
      therapist_id,
      therapists:therapists!reservations_therapist_id_fkey (name),
      course_id,
      courses (name),
      designation_type,
      therapist_back_amount,
      shop_revenue,
      back_calculated_at,
      shops (name)
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  if (resErr) {
    console.error(resErr);
  } else {
    console.log(res.map(r => ({
      id: r.id,
      shop_name: r.shops?.name,
      date: r.date,
      time: r.start_time,
      therapist_name: r.therapists?.name,
      course_name: r.courses?.name,
      designation_type: r.designation_type,
      back_amount: r.therapist_back_amount,
      shop_revenue: r.shop_revenue,
      calculated_at: r.back_calculated_at
    })));
  }
}

main();
