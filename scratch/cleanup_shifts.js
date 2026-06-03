const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('--- 既存シフトデータの時刻フォーマットクリーンアップ (全件ページネーション) ---');

  let allShifts = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: shifts, error } = await serviceClient
      .from('shifts')
      .select('id, therapist_id, date, start_time, end_time, room_id, shop_id')
      .range(from, from + step - 1);

    if (error) {
      console.error('シフトデータの取得に失敗しました:', error);
      return;
    }

    allShifts = allShifts.concat(shifts);
    console.log(`取得中: ${from} 〜 ${from + shifts.length} 件 (現在の累計: ${allShifts.length} 件)`);

    if (shifts.length < step) {
      hasMore = false;
    } else {
      from += step;
    }
  }

  console.log(`総取得シフト数: ${allShifts.length} 件`);

  // 秒数の補完が必要なレコードを特定
  const needsFix = [];
  const formatTime = (t) => {
    if (!t) return t;
    const parts = t.split(':');
    if (parts.length === 2) {
      return `${t}:00`;
    }
    return t;
  };

  allShifts.forEach(s => {
    const origStart = s.start_time;
    const origEnd = s.end_time;
    const fixedStart = formatTime(origStart);
    const fixedEnd = formatTime(origEnd);

    if (origStart !== fixedStart || origEnd !== fixedEnd) {
      needsFix.push({
        ...s,
        fixedStart,
        fixedEnd
      });
    }
  });

  console.log(`時刻フォーマットの修正が必要なレコード数: ${needsFix.length} 件`);

  if (needsFix.length === 0) {
    console.log('修正が必要なデータはありませんでした。');
    return;
  }

  // 2. 修正対象レコードを1件ずつ処理（重複チェックと削除 or 更新）
  let updatedCount = 0;
  let deletedCount = 0;

  for (const s of needsFix) {
    // 既に秒数付きの同じデータが存在するかチェック
    const { data: dup, error: dupErr } = await serviceClient
      .from('shifts')
      .select('id')
      .eq('therapist_id', s.therapist_id)
      .eq('date', s.date)
      .eq('start_time', s.fixedStart)
      .eq('end_time', s.fixedEnd)
      .maybeSingle();

    if (dupErr) {
      console.error(`重複チェック中にエラーが発生しました (ID: ${s.id}):`, dupErr);
      continue;
    }

    if (dup) {
      // 既に秒数付きのレコードが存在するため、このレコードは重複で不要なデータとして削除する
      console.log(`重複データ検出のため削除します: ID ${s.id} (既存: ID ${dup.id})`);
      const { error: delErr } = await serviceClient
        .from('shifts')
        .delete()
        .eq('id', s.id);

      if (delErr) {
        console.error(`削除に失敗しました (ID: ${s.id}):`, delErr);
      } else {
        deletedCount++;
      }
    } else {
      // 重複データが存在しないため、秒数付きにアップデートする
      console.log(`フォーマット更新: ID ${s.id} | ${s.start_time} -> ${s.fixedStart} | ${s.end_time} -> ${s.fixedEnd}`);
      const { error: updErr } = await serviceClient
        .from('shifts')
        .update({
          start_time: s.fixedStart,
          end_time: s.fixedEnd
        })
        .eq('id', s.id);

      if (updErr) {
        console.error(`アップデートに失敗しました (ID: ${s.id}):`, updErr);
      } else {
        updatedCount++;
      }
    }
  }

  console.log('\n--- クリーンアップ完了結果 ---');
  console.log(`更新されたレコード: ${updatedCount} 件`);
  console.log(`削除（統合）された重複レコード: ${deletedCount} 件`);
}

main().catch(console.error);
