/**
 * 取り込みの残骸（人ではない行）を消す。
 *
 * シフト表やCSVを取り込むと、名前が空の行や「7/15体験入店」のような見出し行まで
 * セラピストとして登録されてしまうことがある。これらは一覧にもシフト画面にも出てきて
 * 邪魔になるだけなので消す。
 *
 * 消すのは次の両方を満たす行だけ。
 *   - 名前が空、または「体験入店」を含む見出し
 *   - 予約・シフト・写真・メモの紐付きが1件も無い
 * 1件でも紐付きがあれば触らない。実在のセラピストは名前があるので対象外。
 *
 * 既定は表示のみ。消すときだけ APPLY=1 を付ける。
 *
 *   npx tsx scripts/purge-placeholder-therapists.ts
 *   APPLY=1 npx tsx scripts/purge-placeholder-therapists.ts
 *   SHOP=ラビット立川 npx tsx scripts/purge-placeholder-therapists.ts   # 店舗を絞る
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const APPLY = process.env.APPLY === '1';
const SHOP = process.env.SHOP;

const LINK_TABLES = ['shifts', 'reservations', 'therapist_photos', 'therapist_memos'] as const;

// 人の名前ではない行の見分け方
const isPlaceholder = (name: string | null) => !name || !name.trim() || /体験入店/.test(name);

async function main() {
  const { data: shops, error: shopError } = await db.from('shops').select('id, name');
  if (shopError) throw shopError;
  const shopName = new Map((shops || []).map(s => [s.id, s.name]));
  const targetShopIds = SHOP
    ? (shops || []).filter(s => s.name.includes(SHOP)).map(s => s.id)
    : (shops || []).map(s => s.id);
  if (targetShopIds.length === 0) throw new Error(`店舗が見つかりません: ${SHOP}`);

  const { data: therapists, error } = await db
    .from('therapists')
    .select('id, name, shop_id')
    .in('shop_id', targetShopIds);
  if (error) throw error;

  const candidates = (therapists || []).filter(t => isPlaceholder(t.name));
  console.log(`■ 候補：${candidates.length}件\n`);

  const deletable: typeof candidates = [];
  for (const t of candidates) {
    const counts: Record<string, number> = {};
    for (const table of LINK_TABLES) {
      const { count } = await db.from(table).select('*', { count: 'exact', head: true }).eq('therapist_id', t.id);
      counts[table] = count || 0;
    }
    const linked = Object.values(counts).some(c => c > 0);
    const where = shopName.get(t.shop_id || '') || t.shop_id;
    const detail = Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ');
    console.log(`   ${linked ? '保留' : '削除'}  ${where} / ${JSON.stringify(t.name || '(空)')}  ${detail}  id=${t.id}`);
    if (!linked) deletable.push(t);
  }

  if (!APPLY) {
    console.log(`\n表示のみ（${deletable.length}件が削除対象）。実行するには APPLY=1 を付ける。`);
    return;
  }

  for (const t of deletable) {
    // 在籍行を先に消してから本体を消す
    const { error: rosterError } = await db.from('therapist_shops').delete().eq('therapist_id', t.id);
    if (rosterError) throw new Error(`在籍行の削除に失敗 (${t.id}): ${rosterError.message}`);
    const { error: deleteError } = await db.from('therapists').delete().eq('id', t.id);
    if (deleteError) throw new Error(`削除に失敗 (${t.id}): ${deleteError.message}`);
  }
  console.log(`\n${deletable.length}件を削除しました。`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
