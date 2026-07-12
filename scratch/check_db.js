require('dotenv').config({ path: 'c:/Users/saitou-cyberpunk/Desktop/yoyakukanri/therapist-management-saas/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const shopId = 'dc3caa06-fcc2-4bdc-b063-7969296efd34'; // こころリンス浅草橋
  
  // 1. セラピストの取得
  const { data: therapists, error: tErr } = await supabase
    .from('therapists')
    .select('id, name, is_active')
    .eq('shop_id', shopId);
  
  console.log("Therapists Count:", therapists ? therapists.length : 0);
  console.log("Active Therapists:", therapists ? therapists.filter(t => t.is_active) : []);

  // 2. シフトの取得 (今日から7日間)
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 6);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  const { data: shifts, error: sErr } = await supabase
    .from('shifts')
    .select('id, date, start_time, end_time, therapist_id')
    .eq('shop_id', shopId)
    .gte('date', todayStr)
    .lte('date', nextWeekStr);

  console.log("Shifts Count (next 7 days):", shifts ? shifts.length : 0);
  console.log("Sample Shifts:", shifts ? shifts.slice(0, 5) : []);
}
run();
