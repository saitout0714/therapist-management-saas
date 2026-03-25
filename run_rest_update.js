require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const shopId = 'a0000001-0000-0000-0000-000000000001';

  try {
    console.log("Starting data wipe...");
    // Since we don't know the exact order of cascading, we can just delete from the main tables
    await supabase.from('options').delete().eq('shop_id', shopId);
    await supabase.from('courses').delete().eq('shop_id', shopId);
    await supabase.from('therapist_ranks').delete().eq('shop_id', shopId);
    await supabase.from('deduction_rules').delete().eq('shop_id', shopId);
    await supabase.from('shop_back_rules').delete().eq('shop_id', shopId);

    console.log("Wipe completed. Inserting ranks...");
    await supabase.from('therapist_ranks').insert([
      { id: 'b0000001-0000-0000-0000-000000000001', shop_id: shopId, name: 'シルバー', display_order: 1 },
      { id: 'b0000001-0000-0000-0000-000000000002', shop_id: shopId, name: 'ゴールド', display_order: 2 },
      { id: 'b0000001-0000-0000-0000-000000000003', shop_id: shopId, name: 'プラチナ', display_order: 3 }
    ]);

    console.log("Inserting courses...");
    await supabase.from('courses').insert([
      { id: 'c0000001-0001-0000-0000-000000000001', shop_id: shopId, name: 'コミ60分', duration: 60, base_price: 16000, is_active: true, display_order: 1 },
      { id: 'c0000001-0001-0000-0000-000000000002', shop_id: shopId, name: 'コミ100分', duration: 100, base_price: 21000, is_active: true, display_order: 2 },
      { id: 'c0000001-0001-0000-0000-000000000004', shop_id: shopId, name: 'プレミアム120分', duration: 120, base_price: 24000, is_active: true, display_order: 3 },
      { id: 'c0000001-0001-0000-0000-000000000005', shop_id: shopId, name: 'プレミアム150分', duration: 150, base_price: 29000, is_active: true, display_order: 4 },
      { id: 'c0000001-0001-0000-0000-000000000003', shop_id: shopId, name: '延長30分', duration: 30, base_price: 6000, is_active: true, display_order: 5 }
    ]);

    console.log("Inserting options...");
    await supabase.from('options').insert([
      { id: 'd0000001-0001-0000-0000-000000000001', shop_id: shopId, name: '衣装チェンジ', price: 2000, is_active: true, display_order: 1 },
      { id: 'd0000001-0001-0000-0000-000000000002', shop_id: shopId, name: '極液', price: 2000, is_active: true, display_order: 2 },
      { id: 'd0000001-0001-0000-0000-000000000003', shop_id: shopId, name: 'ホイップ', price: 2000, is_active: true, display_order: 3 },
      { id: 'd0000001-0001-0000-0000-000000000004', shop_id: shopId, name: '水着', price: 2000, is_active: true, display_order: 4 },
      { id: 'd0000001-0001-0000-0000-000000000005', shop_id: shopId, name: '指名料', price: 1000, is_active: true, display_order: 5 },
      { id: 'd0000001-0001-0000-0000-000000000006', shop_id: shopId, name: '写真指名', price: 1000, is_active: true, display_order: 6 },
      { id: 'd0000001-0001-0000-0000-000000000007', shop_id: shopId, name: '姫予約', price: 1000, is_active: true, display_order: 7 },
      { id: 'd0000001-0001-0000-0000-000000000008', shop_id: shopId, name: '認定指名料（60分・100分）', price: 1000, is_active: true, display_order: 8 },
      { id: 'd0000001-0001-0000-0000-000000000009', shop_id: shopId, name: '認定指名料（120分以上）', price: 2000, is_active: true, display_order: 9 }
    ]);

    console.log("Inserting deduction rules...");
    await supabase.from('deduction_rules').insert([
      { shop_id: shopId, name: '厚生費', category: 'deduction', calc_timing: 'per_reservation', amount: 800, min_duration: 0, is_active: true },
      { shop_id: shopId, name: '交通費', category: 'allowance', calc_timing: 'per_shift', amount: 2000, min_duration: 0, is_active: true }
    ]);

    console.log("Inserting shop back rules...");
    await supabase.from('shop_back_rules').upsert([
      { shop_id: shopId, course_calc_type: 'fixed', course_back_rate: 0, option_calc_type: 'full_back', option_back_rate: 100, nomination_calc_type: 'full_back', nomination_back_rate: 100, rounding_method: 'floor', business_day_cutoff: '06:00' }
    ]);

    console.log("Inserting course back amounts...");
    const amounts = [
      // コミ60分
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000001', rank_id: 'b0000001-0000-0000-0000-000000000001', designation_type: 'free', back_amount: 6700, customer_price: 16000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000001', rank_id: 'b0000001-0000-0000-0000-000000000001', designation_type: 'first_nomination', back_amount: 7200, customer_price: 16000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000001', rank_id: 'b0000001-0000-0000-0000-000000000001', designation_type: 'confirmed', back_amount: 7700, customer_price: 16000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000001', rank_id: 'b0000001-0000-0000-0000-000000000002', designation_type: 'free', back_amount: 7200, customer_price: 16000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000001', rank_id: 'b0000001-0000-0000-0000-000000000002', designation_type: 'first_nomination', back_amount: 7700, customer_price: 16000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000001', rank_id: 'b0000001-0000-0000-0000-000000000002', designation_type: 'confirmed', back_amount: 8200, customer_price: 16000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000001', rank_id: 'b0000001-0000-0000-0000-000000000003', designation_type: 'free', back_amount: 7700, customer_price: 16000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000001', rank_id: 'b0000001-0000-0000-0000-000000000003', designation_type: 'first_nomination', back_amount: 8700, customer_price: 16000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000001', rank_id: 'b0000001-0000-0000-0000-000000000003', designation_type: 'confirmed', back_amount: 9700, customer_price: 16000 },

      // コミ100分
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000002', rank_id: 'b0000001-0000-0000-0000-000000000001', designation_type: 'free', back_amount: 9200, customer_price: 21000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000002', rank_id: 'b0000001-0000-0000-0000-000000000001', designation_type: 'first_nomination', back_amount: 9700, customer_price: 21000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000002', rank_id: 'b0000001-0000-0000-0000-000000000001', designation_type: 'confirmed', back_amount: 10200, customer_price: 21000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000002', rank_id: 'b0000001-0000-0000-0000-000000000002', designation_type: 'free', back_amount: 10200, customer_price: 21000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000002', rank_id: 'b0000001-0000-0000-0000-000000000002', designation_type: 'first_nomination', back_amount: 10700, customer_price: 21000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000002', rank_id: 'b0000001-0000-0000-0000-000000000002', designation_type: 'confirmed', back_amount: 11200, customer_price: 21000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000002', rank_id: 'b0000001-0000-0000-0000-000000000003', designation_type: 'free', back_amount: 11200, customer_price: 21000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000002', rank_id: 'b0000001-0000-0000-0000-000000000003', designation_type: 'first_nomination', back_amount: 12200, customer_price: 21000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000002', rank_id: 'b0000001-0000-0000-0000-000000000003', designation_type: 'confirmed', back_amount: 13200, customer_price: 21000 },

      // プレミアム120分
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000004', rank_id: 'b0000001-0000-0000-0000-000000000001', designation_type: 'free', back_amount: 11200, customer_price: 24000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000001', rank_id: 'b0000001-0000-0000-0000-000000000001', designation_type: 'first_nomination', back_amount: 11700, customer_price: 24000 }, // Wait, error: c000...4 is 120min
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000004', rank_id: 'b0000001-0000-0000-0000-000000000001', designation_type: 'first_nomination', back_amount: 11700, customer_price: 24000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000004', rank_id: 'b0000001-0000-0000-0000-000000000001', designation_type: 'confirmed', back_amount: 12200, customer_price: 24000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000004', rank_id: 'b0000001-0000-0000-0000-000000000002', designation_type: 'free', back_amount: 11700, customer_price: 24000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000004', rank_id: 'b0000001-0000-0000-0000-000000000002', designation_type: 'first_nomination', back_amount: 12200, customer_price: 24000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000004', rank_id: 'b0000001-0000-0000-0000-000000000002', designation_type: 'confirmed', back_amount: 12700, customer_price: 24000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000004', rank_id: 'b0000001-0000-0000-0000-000000000003', designation_type: 'free', back_amount: 12200, customer_price: 24000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000004', rank_id: 'b0000001-0000-0000-0000-000000000003', designation_type: 'first_nomination', back_amount: 13200, customer_price: 24000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000004', rank_id: 'b0000001-0000-0000-0000-000000000003', designation_type: 'confirmed', back_amount: 14200, customer_price: 24000 },

      // プレミアム150分
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000005', rank_id: 'b0000001-0000-0000-0000-000000000001', designation_type: 'free', back_amount: 13700, customer_price: 29000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000005', rank_id: 'b0000001-0000-0000-0000-000000000001', designation_type: 'first_nomination', back_amount: 14200, customer_price: 29000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000005', rank_id: 'b0000001-0000-0000-0000-000000000001', designation_type: 'confirmed', back_amount: 14700, customer_price: 29000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000005', rank_id: 'b0000001-0000-0000-0000-000000000002', designation_type: 'free', back_amount: 14200, customer_price: 29000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000005', rank_id: 'b0000001-0000-0000-0000-000000000002', designation_type: 'first_nomination', back_amount: 14700, customer_price: 29000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000005', rank_id: 'b0000001-0000-0000-0000-000000000002', designation_type: 'confirmed', back_amount: 15200, customer_price: 29000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000005', rank_id: 'b0000001-0000-0000-0000-000000000003', designation_type: 'free', back_amount: 14700, customer_price: 29000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000005', rank_id: 'b0000001-0000-0000-0000-000000000003', designation_type: 'first_nomination', back_amount: 15700, customer_price: 29000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000005', rank_id: 'b0000001-0000-0000-0000-000000000003', designation_type: 'confirmed', back_amount: 16700, customer_price: 29000 },

      // 延長30分
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000003', rank_id: 'b0000001-0000-0000-0000-000000000001', designation_type: 'free', back_amount: 3000, customer_price: 6000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000003', rank_id: 'b0000001-0000-0000-0000-000000000002', designation_type: 'free', back_amount: 3200, customer_price: 6000 },
      { shop_id: shopId, course_id: 'c0000001-0001-0000-0000-000000000003', rank_id: 'b0000001-0000-0000-0000-000000000003', designation_type: 'free', back_amount: 3400, customer_price: 6000 },
    ];

    // Note: I had a typo above. Let's fix the typo by filtering out the invalid first_nomination
    const validAmounts = amounts.filter(a => a.course_id !== 'c0000001-0001-0000-0000-000000000001' || a.customer_price !== 24000);

    for (let i = 0; i < validAmounts.length; i += 10) {
        const chunk = validAmounts.slice(i, i + 10);
        await supabase.from('course_back_amounts').insert(chunk);
    }

    console.log("Done successfully!");

  } catch (err) {
    console.error("Error running script:", err);
  }
}

run();
