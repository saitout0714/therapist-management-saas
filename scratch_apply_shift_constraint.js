const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyShiftConstraint() {
  console.log("=== DBのシフトユニーク制約変更を試行 ===");

  // テスト挿入で動作確認
  const therapistId = 'dd45727a-aae1-4a0b-b592-cc07704641d1'; // Shirakawa Yuri
  const yudaShopId = '508def9b-cd72-439d-9bbc-2dbe5e3a8af4';
  const shunanShopId = 'e6b1cc21-c9eb-4fc1-888d-6f965a90c1df';

  const { data: s1, error: e1 } = await supabase.from('shifts').insert([{
    therapist_id: therapistId,
    shop_id: yudaShopId,
    date: '2026-07-25',
    start_time: '14:00',
    end_time: '20:00'
  }]).select('id');

  console.log("山口湯田 14:00-20:00 挿入結果:", s1 || e1?.message);

  const { data: s2, error: e2 } = await supabase.from('shifts').insert([{
    therapist_id: therapistId,
    shop_id: shunanShopId,
    date: '2026-07-25',
    start_time: '14:00',
    end_time: '20:00'
  }]).select('id');

  console.log("周南下松 14:00-20:00 挿入結果:", s2 || e2?.message);
}

applyShiftConstraint();
