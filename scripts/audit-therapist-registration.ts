/**
 * セラピスト登録の不整合を洗い出す（必要なら直す）。
 *
 * 「シフトには2人いるのに在籍には1人」の類はここで見つかる。
 * 画面ごとに見ているデータが違うため、次の2つがズレると重複に見える。
 *
 *   A) 在籍行（therapist_shops）が無いセラピスト
 *      → 一覧・シフト表には出ないが、shop_id を見ていた画面にだけ出る幽霊。
 *        在籍行の作成に失敗した取り込みの残骸。
 *   B) 全体の在籍状況（therapists.is_active）と
 *      店舗の在籍状況（therapist_shops.is_active）の食い違い
 *      → 「退店にしたのにシフト画面から消えない」の正体。
 *   C) 同じ店舗に同名で在籍中が複数（重複登録の疑い）
 *
 * 既定は表示のみ。APPLY=1 を付けたときだけ B を therapists 側に合わせて直す。
 * A と C は消す／残すの判断が要るので、ここでは報告だけにする。
 *
 *   npx tsx scripts/audit-therapist-registration.ts
 *   APPLY=1 npx tsx scripts/audit-therapist-registration.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const APPLY = process.env.APPLY === '1';

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(select).range(from, from + 999);
    if (error) throw error;
    out.push(...(data as unknown as T[]));
    if (data.length < 1000) break;
  }
  return out;
}

type Shop = { id: string; name: string };
type Therapist = { id: string; name: string; shop_id: string | null; is_active: boolean; created_at: string };
type Roster = { therapist_id: string; shop_id: string; is_active: boolean };

async function main() {
  const shops = await fetchAll<Shop>('shops', 'id, name');
  const shopName = new Map(shops.map(s => [s.id, s.name]));
  const therapists = await fetchAll<Therapist>('therapists', 'id, name, shop_id, is_active, created_at');
  const roster = await fetchAll<Roster>('therapist_shops', 'therapist_id, shop_id, is_active');

  const rosterOf = new Map<string, Roster[]>();
  roster.forEach(r => {
    const list = rosterOf.get(r.therapist_id) || [];
    list.push(r);
    rosterOf.set(r.therapist_id, list);
  });
  const label = (t: Therapist) => `${shopName.get(t.shop_id || '') || t.shop_id} / ${t.name}`;

  // A) 在籍行が1件も無い
  const ghosts = therapists.filter(t => t.shop_id && !rosterOf.has(t.id));
  console.log(`\n■ A) 在籍行が無いセラピスト：${ghosts.length}件`);
  ghosts.forEach(t => console.log(`   ${label(t)}（登録 ${t.created_at.slice(0, 10)}）  id=${t.id}`));
  if (ghosts.length > 0) {
    console.log('   → 取り込みの残骸なら削除、実在するなら在籍行を作る。どちらかは中身を見て判断すること。');
  }

  // B) 在籍状況の食い違い（主所属店舗の行のみ）
  const mismatched = therapists.flatMap(t =>
    (rosterOf.get(t.id) || [])
      .filter(r => r.shop_id === t.shop_id && r.is_active !== t.is_active)
      .map(r => ({ t, r }))
  );
  console.log(`\n■ B) 全体と店舗で在籍状況が食い違う：${mismatched.length}件`);
  mismatched.forEach(({ t, r }) =>
    console.log(`   ${label(t)}  全体=${t.is_active ? '在籍中' : '退店'} / 店舗=${r.is_active ? '在籍中' : '退店'}  id=${t.id}`)
  );
  if (mismatched.length > 0 && !APPLY) {
    console.log('   → APPLY=1 を付けて実行すると、店舗側を全体側に合わせて直す。');
  }
  if (mismatched.length > 0 && APPLY) {
    for (const { t, r } of mismatched) {
      const { error } = await db
        .from('therapist_shops')
        .update({ is_active: t.is_active })
        .eq('therapist_id', t.id)
        .eq('shop_id', r.shop_id);
      if (error) throw new Error(`${label(t)} の修正に失敗: ${error.message}`);
      console.log(`   修正: ${label(t)} → 店舗側を ${t.is_active ? '在籍中' : '退店'} に`);
    }
  }

  // C) 同じ店舗に同名で在籍中が複数
  const activeById = new Map(therapists.map(t => [t.id, t]));
  const byShopName = new Map<string, Therapist[]>();
  roster.filter(r => r.is_active).forEach(r => {
    const t = activeById.get(r.therapist_id);
    if (!t || t.is_active === false) return;
    const key = `${r.shop_id}::${t.name}`;
    const list = byShopName.get(key) || [];
    list.push(t);
    byShopName.set(key, list);
  });
  const dups = [...byShopName.entries()].filter(([, v]) => v.length > 1);
  console.log(`\n■ C) 同じ店舗に同名で在籍中：${dups.length}件`);
  dups.forEach(([key, list]) => {
    const [shopId, name] = key.split('::');
    console.log(`   ${shopName.get(shopId) || shopId} / ${name || '(名前なし)'} × ${list.length}`);
    list.forEach(t => console.log(`      登録 ${t.created_at.slice(0, 10)}  id=${t.id}`));
  });
  if (dups.length > 0) {
    console.log('   → 別人（源氏名かぶり）なら放置で良い。同一人物なら予約・シフトを片方に寄せてから削除する。');
  }

  console.log(APPLY ? '\n完了（B のみ修正した）' : '\n表示のみ（何も変更していない）');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
