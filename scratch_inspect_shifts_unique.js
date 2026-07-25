const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectUniqueConstraints() {
  // test insert of duplicate shift in different shop to see exact DB error
  const therapistId = 'dd45727a-aae1-4a0b-b592-cc07704641d1'; // Shirakawa Yuri
  const yudaShopId = '508def9b-cd72-439d-9bbc-2dbe5e3a8af4';
  const shunanShopId = 'e6b1cc21-c9eb-4fc1-888d-6f965a90c1df';

  console.log("=== 1. 山口湯田へのシフト挿入テスト ===");
  const { data: s1, error: e1 } = await supabase.from('shifts').insert([{
    therapist_id: therapistId,
    shop_id: yudaShopId,
    date: '2026-08-01',
    start_time: '14:00',
    end_time: '20:00'
  }]).select('id');
  console.log("s1:", s1, e1);

  console.log("=== 2. 周南下松への同じ時間帯のシフト挿入テスト ===");
  const { data: s2, error: e2 } = await supabase.from('shifts').insert([{
    therapist_id: therapistId,
    shop_id: shunanShopId,
    date: '2026-08-01',
    start_time: '14:00',
    end_time: '20:00'
  }]).select('id');
  console.log("s2:", s2, e2);

  // テスト用データの後始末
  if (s1 && s1[0]) await supabase.from('shifts').delete().eq('id', s1[0].id);
  if (s2 && s2[0]) await supabase.from('shifts').delete().eq('id', s2[0].id);
}

inspectUniqueConstraints();
