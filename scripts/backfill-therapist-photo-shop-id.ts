/**
 * Phase 2.5 準備：therapist_photos.shop_id を全件バックフィルする。
 *
 * 列は Phase 2 ステップ1で追加済みだが、値は1件も入っていない
 * （1,492件中0件）。今は1レコード=1店舗なので、現在の
 * therapists.shop_id をそのまま写真の店舗として写せば、
 * 今の見え方を保ったまま列を埋められる。
 *
 * これを重複統合（8組）より先に済ませておく必要がある。
 * 統合すると消える側の therapists.shop_id が失われ、
 * その人の写真がどちらの店舗のものか分からなくなるため。
 *
 * 実行は冪等。DRY_RUN=1 で予定のみ表示。
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const DRY_RUN = process.env.DRY_RUN === '1';

async function fetchAll(table: string, select: string) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(select).range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

async function main() {
  const therapists = await fetchAll('therapists', 'id, shop_id');
  const shopOf = new Map(therapists.map(t => [t.id, t.shop_id]));

  const photos = await fetchAll('therapist_photos', 'id, therapist_id, shop_id');

  const toFix = photos.filter(p => {
    const correctShop = shopOf.get(p.therapist_id);
    return correctShop && p.shop_id !== correctShop;
  });
  const orphaned = photos.filter(p => !shopOf.has(p.therapist_id));

  console.log('■ 実行内容\n');
  console.log(`   写真の総数         : ${photos.length}件`);
  console.log(`   shop_id を設定/修正 : ${toFix.length}件`);
  console.log(`   既に正しい          : ${photos.length - toFix.length - orphaned.length}件`);
  console.log(`   持ち主不明（孤児）  : ${orphaned.length}件${orphaned.length ? ' ★要確認 id=' + orphaned.slice(0, 10).map(o => o.id).join(',') : ''}`);

  if (DRY_RUN) {
    console.log('\n（DRY_RUN のため何も変更していません）');
    return;
  }

  for (let i = 0; i < toFix.length; i += 500) {
    const chunk = toFix.slice(i, i + 500);
    for (const p of chunk) {
      const { error } = await db
        .from('therapist_photos')
        .update({ shop_id: shopOf.get(p.therapist_id) })
        .eq('id', p.id);
      if (error) throw new Error(`写真 ${p.id} の更新に失敗: ${error.message}`);
    }
    console.log(`   ${Math.min(i + 500, toFix.length)} / ${toFix.length} 件処理`);
  }

  const after = await fetchAll('therapist_photos', 'id, shop_id');
  const filled = after.filter(p => p.shop_id).length;
  console.log('\n■ 変更後\n');
  console.log(`   shop_id あり : ${filled} / ${after.length}件`);
}

main().catch(e => {
  console.error('失敗:', e.message);
  process.exitCode = 1;
});
