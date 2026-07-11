const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Supabase URL or Key missing in .env.local");
    return;
  }

  const supabase = createClient(url, key);

  console.log("=== SHOPS ===");
  const { data: shops, error: shopsErr } = await supabase.from('shops').select('id, name');
  if (shopsErr) console.error(shopsErr);
  else console.log(shops);

  console.log("\n=== DESIGNATION TYPES ===");
  const { data: dts, error: dtsErr } = await supabase.from('designation_types').select('id, shop_id, slug, display_name, treats_as_confirmed');
  if (dtsErr) console.error(dtsErr);
  else console.log(dts);

  console.log("\n=== THERAPIST OPTION BACKS ===");
  const { data: tobs, error: tobsErr } = await supabase.from('therapist_option_backs').select('id, shop_id, therapist_id, option_category, designation_type, back_rate');
  if (tobsErr) console.error(tobsErr);
  else {
    // セラピスト名もくっつける
    const { data: therapists } = await supabase.from('therapists').select('id, name');
    const tMap = new Map(therapists?.map(t => [t.id, t.name]) || []);
    console.log(tobs.map(t => ({
      ...t,
      therapist_name: tMap.get(t.therapist_id) || t.therapist_id
    })));
  }

  console.log("\n=== SHOP BACK RULES ===");
  const { data: sbrs, error: sbrsErr } = await supabase.from('shop_back_rules').select('shop_id, course_calc_type, option_calc_type, option_back_rate, option_back_amount');
  if (sbrsErr) console.error(sbrsErr);
  else console.log(sbrs);
}

main();
