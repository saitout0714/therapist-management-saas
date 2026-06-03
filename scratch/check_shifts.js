const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('--- シフトの重複・競合データの確認 ---');

  // 1. 全シフトを取得して、同じ (therapist_id, date) で複数レコードが存在するものを抽出
  const { data: shifts, error } = await serviceClient
    .from('shifts')
    .select('id, shop_id, therapist_id, date, start_time, end_time, room_id')
    .order('date', { ascending: false });

  if (error) {
    console.error('シフトの取得に失敗:', error);
    return;
  }

  console.log(`総シフト数: ${shifts.length} 件`);

  // 重複をチェック
  const map = {};
  const duplicates = [];

  shifts.forEach(s => {
    const key = `${s.therapist_id}_${s.date}`;
    if (!map[key]) {
      map[key] = [];
    }
    map[key].push(s);
  });

  Object.keys(map).forEach(key => {
    if (map[key].length > 1) {
      duplicates.push({
        key,
        records: map[key]
      });
    }
  });

  console.log(`\n重複（同じセラピスト・同じ日に複数シフトが存在する）箇所: ${duplicates.length} 日分`);

  if (duplicates.length > 0) {
    console.log('\n--- 重複データの詳細 (最初の5件) ---');
    duplicates.slice(0, 5).forEach((d, i) => {
      console.log(`\n[${i+1}] キー: ${d.key}`);
      d.records.forEach(r => {
        console.log(`  ID: ${r.id} | 時間: ${r.start_time} - ${r.end_time} | ルームID: ${r.room_id}`);
      });
    });
  } else {
    console.log('同じ日に複数シフトを持つ重複データは存在しません。');
  }
}

main().catch(console.error);
