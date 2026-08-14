/**
 * therapist_shops から「別オーナーの店舗を指す行」を削除する。
 *
 * 2026-07-25 に店舗別源氏名の機能を追加した際、既存データを埋める処理が
 * 名前だけで同一人物を判定したため、たまたま源氏名が同じ別人が紐づいた。
 * 「ゆあ」「せな」「もも」のような源氏名はどの店にもいるので大量に発生している。
 * プロフィールを見ると身長が5〜16cm違うなど、明らかに別人（オーナー確認済み）。
 *
 * 同一オーナー内の行は対象外。オーナーが違えば経営が別であり、在籍は重ならない。
 *
 * DRY_RUN=1 で予定のみ表示。
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
  const shops = await fetchAll('shops', 'id, name, owner_id');
  const shopById = new Map(shops.map(s => [s.id, s]));
  const therapists = await fetchAll('therapists', 'id, name, shop_id');
  const thById = new Map(therapists.map(t => [t.id, t]));
  const rows = await fetchAll('therapist_shops', 'therapist_id, shop_id');

  const doomed = rows.filter(r => {
    const t = thById.get(r.therapist_id);
    if (!t) return false;
    const ownerOfTherapist = shopById.get(t.shop_id)?.owner_id;
    const ownerOfRow = shopById.get(r.shop_id)?.owner_id;
    return ownerOfTherapist && ownerOfRow && ownerOfTherapist !== ownerOfRow;
  });

  console.log(`■ 削除対象 ${doomed.length}行 / 全${rows.length}行\n`);
  doomed.forEach(r => {
    const t = thById.get(r.therapist_id);
    console.log(`   ${String(t.name).padEnd(10)} ${String(shopById.get(t.shop_id).name).padEnd(16)} → ${shopById.get(r.shop_id).name}`);
  });

  if (DRY_RUN) {
    console.log('\n（DRY_RUN のため何も削除していません）');
    return;
  }

  let done = 0;
  for (const r of doomed) {
    const { error } = await db
      .from('therapist_shops')
      .delete()
      .eq('therapist_id', r.therapist_id)
      .eq('shop_id', r.shop_id);
    if (error) throw new Error(`削除に失敗: ${error.message}`);
    done++;
  }

  const after = await fetchAll('therapist_shops', 'therapist_id, shop_id');
  const stillCross = after.filter(r => {
    const t = thById.get(r.therapist_id);
    if (!t) return false;
    const a = shopById.get(t.shop_id)?.owner_id;
    const b = shopById.get(r.shop_id)?.owner_id;
    return a && b && a !== b;
  });

  console.log(`\n■ 変更後\n`);
  console.log(`   削除した行            : ${done}行`);
  console.log(`   therapist_shops の行数: ${after.length}行`);
  console.log(`   別オーナーを指す行    : ${stillCross.length}行（0なら完了）`);
}

main().catch(e => {
  console.error('失敗:', e.message);
  process.exitCode = 1;
});
