/**
 * ローズカフェと ICHIGUN で同一人物のセラピストを紐付ける。
 *
 *   ローズカフェ「美波」 ＝ ICHIGUN「立花 ひかり」
 *   ローズカフェ「春井」 ＝ ICHIGUN「山下 りこ」
 *
 * 同一人物であることはオーナー本人の申告による。プロフィール（年齢・身長）は
 * 店舗ごとに異なるため、データからは判定できない。名前の一致で機械的に寄せてはいけない
 * （同名でも別人の例が実際にあった）。
 *
 * 紐付けると精算で両店の売上がまとまる。名前やプロフィールは店舗ごとのまま変わらない。
 * shop_links は管理画面のリンク設定欄を表示するために必要。
 * どちらも Phase 2 で therapist_shops へ移行する予定の暫定的な仕組み。
 *
 * 実行は冪等。DRY_RUN=1 で予定のみ表示。
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config({ path: '.env.local' });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DRY_RUN = process.env.DRY_RUN === '1';

/** ローズカフェ側の名前 → ICHIGUN側の名前 */
const PAIRS: [string, string][] = [
  ['美波', '立花 ひかり'],
  ['春井', '山下 りこ'],
];

async function main() {
  const { data: shops } = await db.from('shops').select('id, name, owner_id').in('name', ['ローズカフェ', 'ICHIGUN']);
  const rose = shops?.find(s => s.name === 'ローズカフェ');
  const ichigun = shops?.find(s => s.name === 'ICHIGUN');
  if (!rose || !ichigun) throw new Error('対象店舗が見つかりません');

  const { data: therapists } = await db
    .from('therapists')
    .select('id, name, shop_id, is_active, linked_therapist_group_id')
    .in('shop_id', [rose.id, ichigun.id]);
  const find = (shopId: string, name: string) =>
    (therapists || []).find(t => t.shop_id === shopId && t.name === name);

  console.log('■ 対象の確認\n');
  const resolved: { roseT: any; ichiT: any }[] = [];
  for (const [roseName, ichiName] of PAIRS) {
    const roseT = find(rose.id, roseName);
    const ichiT = find(ichigun.id, ichiName);
    if (!roseT || !ichiT) {
      throw new Error(`該当セラピストが見つかりません: ${roseName} / ${ichiName}`);
    }
    console.log(`   ローズカフェ「${roseT.name}」 ↔ ICHIGUN「${ichiT.name}」`
      + `  現在のリンク: ${roseT.linked_therapist_group_id || 'なし'} / ${ichiT.linked_therapist_group_id || 'なし'}`);
    resolved.push({ roseT, ichiT });
  }

  // --- 連携店舗の登録 ---
  const { data: existingLink } = await db
    .from('shop_links')
    .select('id, is_active')
    .or(`and(shop_id_1.eq.${rose.id},shop_id_2.eq.${ichigun.id}),and(shop_id_1.eq.${ichigun.id},shop_id_2.eq.${rose.id})`)
    .maybeSingle();

  console.log('\n■ 実行内容\n');
  console.log(`   連携店舗の登録: ${existingLink ? '既にあり（変更なし）' : 'ローズカフェ ↔ ICHIGUN を新規登録'}`);
  if (!existingLink && !DRY_RUN) {
    const { error } = await db.from('shop_links').insert([
      { shop_id_1: rose.id, shop_id_2: ichigun.id, is_active: true },
    ]);
    if (error) throw new Error(`連携店舗の登録に失敗: ${error.message}`);
  }

  // --- セラピストの紐付け ---
  for (const { roseT, ichiT } of resolved) {
    // どちらかに既にグループIDがあればそれを流用する
    const groupId = roseT.linked_therapist_group_id || ichiT.linked_therapist_group_id || randomUUID();
    const already = roseT.linked_therapist_group_id === ichiT.linked_therapist_group_id
      && !!roseT.linked_therapist_group_id;

    console.log(`   ${roseT.name} ↔ ${ichiT.name}: ${already ? '既に紐付け済み（変更なし）' : `グループID ${groupId.slice(0, 8)} で紐付け`}`);
    if (already || DRY_RUN) continue;

    const { error } = await db
      .from('therapists')
      .update({ linked_therapist_group_id: groupId })
      .in('id', [roseT.id, ichiT.id]);
    if (error) throw new Error(`${roseT.name} の紐付けに失敗: ${error.message}`);
  }

  if (DRY_RUN) {
    console.log('\n（DRY_RUN のため何も変更していません）');
    return;
  }

  // --- 結果確認 ---
  const { data: after } = await db
    .from('therapists')
    .select('id, name, shop_id, linked_therapist_group_id')
    .in('shop_id', [rose.id, ichigun.id])
    .not('linked_therapist_group_id', 'is', null);
  const nameOf = new Map([[rose.id, 'ローズカフェ'], [ichigun.id, 'ICHIGUN']]);
  const groups = new Map<string, string[]>();
  (after || []).forEach(t => {
    const k = t.linked_therapist_group_id!;
    groups.set(k, [...(groups.get(k) || []), `${t.name}（${nameOf.get(t.shop_id)}）`]);
  });

  console.log('\n■ 変更後\n');
  console.log(`   紐付いたセラピスト: ${(after || []).length}名 / ${groups.size}組`);
  [...groups.values()].forEach(v => console.log(`      ${v.join('  ↔  ')}`));

  // 他店に影響が出ていないこと
  const { count: total } = await db
    .from('therapists')
    .select('id', { count: 'exact', head: true })
    .not('linked_therapist_group_id', 'is', null);
  console.log(`\n   全体の紐付け済みセラピスト: ${total}名（秘密妻・アーバンスパの10名 + 今回の4名 = 14名が想定値）`);
}

main().catch(e => {
  console.error('失敗:', e.message);
  process.exitCode = 1;
});
