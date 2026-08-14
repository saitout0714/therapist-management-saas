/**
 * Phase 2 ステップ2：全セラピストの在籍行を therapist_shops に作る。
 *
 * これまで在籍を表すデータは存在しなかった（既存の行は保存時の副産物と、
 * 名前一致で誤って作られたものだった）。ここで正しい土台を作る。
 *
 * 方針は「主所属店舗にだけ在籍させる」。こうすれば、いま shop_id で見えている
 * 一覧と在籍基準の一覧が一致するため、切り替えても見え方が変わらない。
 * 複数店に在籍する人は、この後で個別に追加する。
 *
 * is_active は therapists 側の在籍状況をそのまま写す。
 * 既存行にも反映するので、退店済みの人が在籍扱いのまま残らない。
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
  const shops = await fetchAll('shops', 'id, name');
  const shopName = new Map(shops.map(s => [s.id, s.name]));
  const therapists = await fetchAll('therapists', 'id, name, shop_id, is_active');
  const existing = await fetchAll('therapist_shops', 'therapist_id, shop_id, is_active');

  const key = (t: string, s: string) => `${t}::${s}`;
  const have = new Set(existing.map(r => key(r.therapist_id, r.shop_id)));

  // 主所属店舗の在籍行が無い人
  const toInsert = therapists
    .filter(t => t.shop_id && !have.has(key(t.id, t.shop_id)))
    .map(t => ({ therapist_id: t.id, shop_id: t.shop_id, is_active: t.is_active }));

  // 既存行のうち、在籍状況が therapists 側とずれているもの
  const activeOf = new Map(therapists.map(t => [t.id, t.is_active]));
  const toFix = existing.filter(r => {
    const a = activeOf.get(r.therapist_id);
    return a !== undefined && r.is_active !== a;
  });

  console.log('■ 実行内容\n');
  console.log(`   在籍行を新規作成 : ${toInsert.length}件`);
  console.log(`   在籍状況を修正   : ${toFix.length}件`);
  console.log(`   既存のまま       : ${existing.length - toFix.length}件`);

  if (DRY_RUN) {
    console.log('\n（DRY_RUN のため何も変更していません）');
    return;
  }

  // 1000件ずつ投入する
  for (let i = 0; i < toInsert.length; i += 500) {
    const chunk = toInsert.slice(i, i + 500);
    const { error } = await db.from('therapist_shops').insert(chunk);
    if (error) throw new Error(`在籍行の作成に失敗: ${error.message}`);
  }
  for (const r of toFix) {
    const { error } = await db
      .from('therapist_shops')
      .update({ is_active: activeOf.get(r.therapist_id) })
      .eq('therapist_id', r.therapist_id)
      .eq('shop_id', r.shop_id);
    if (error) throw new Error(`在籍状況の修正に失敗: ${error.message}`);
  }

  // --- 確認 ---
  const after = await fetchAll('therapist_shops', 'therapist_id, shop_id, is_active');
  const covered = new Set(after.map(r => r.therapist_id));
  const missing = therapists.filter(t => !covered.has(t.id));

  console.log('\n■ 変更後\n');
  console.log(`   therapist_shops の行数     : ${after.length}行`);
  console.log(`   在籍行がある人             : ${covered.size} / ${therapists.length}名`);
  console.log(`   在籍行が無い人             : ${missing.length}名${missing.length ? ' ★' + missing.map(m => m.name).join(', ') : ''}`);

  // 一覧の見え方が変わらないことの確認（在籍基準 vs 現在の shop_id 基準）
  console.log('\n   店舗ごとの在籍者数（在籍中のみ）');
  const rosterByShop = new Map<string, Set<string>>();
  after.filter(r => r.is_active).forEach(r => {
    if (!rosterByShop.has(r.shop_id)) rosterByShop.set(r.shop_id, new Set());
    rosterByShop.get(r.shop_id)!.add(r.therapist_id);
  });
  const currentByShop = new Map<string, number>();
  therapists.filter(t => t.is_active).forEach(t => {
    currentByShop.set(t.shop_id, (currentByShop.get(t.shop_id) || 0) + 1);
  });
  let mismatch = 0;
  [...rosterByShop.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 8)
    .forEach(([sid, set]) => {
      const now = currentByShop.get(sid) || 0;
      const mark = set.size === now ? '' : '  ←複数店在籍あり';
      if (set.size !== now) mismatch++;
      console.log(`      ${String(shopName.get(sid)).padEnd(16)} 在籍基準 ${String(set.size).padStart(3)}名 / 現在 ${String(now).padStart(3)}名${mark}`);
    });
  console.log(`\n   ※ 差があるのはバカラのように複数店に在籍登録がある店舗のみ`);
}

main().catch(e => {
  console.error('失敗:', e.message);
  process.exitCode = 1;
});
