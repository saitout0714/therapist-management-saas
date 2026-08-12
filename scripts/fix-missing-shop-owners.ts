/**
 * オーナー未設定の店舗にオーナーを割り当てる。
 *
 * 店舗登録画面が owners への書き込みに失敗しても店舗だけ作っていたため、
 * オーナー未設定の店舗が2件できていた（登録画面側は別途修正済み）。
 *
 * - おニャンこスパ … 単独オーナー。新しいグループを作る
 * - ICHIGUN      … ローズカフェと同じオーナー。既存グループに加える
 *
 * 料金・バックの共有設定はオーナー側が持つが、ローズカフェのオーナーは
 * pricing_mode / back_mode とも independent なので、ICHIGUN を加えても
 * 両店とも自店のデータを使うまま変わらない。
 *
 * 実行は冪等。既に設定済みなら何もしない。
 * DRY_RUN=1 を付けると変更せず予定だけ表示する。
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DRY_RUN = process.env.DRY_RUN === '1';

async function main() {
  const { data: shops, error } = await db.from('shops').select('id, name, owner_id');
  if (error) throw error;
  const { data: owners } = await db.from('owners').select('id, name');
  const ownerName = new Map((owners || []).map(o => [o.id, o.name]));

  const byName = new Map(shops.map(s => [s.name, s]));
  const onyanko = byName.get('おニャンこスパ');
  const ichigun = byName.get('ICHIGUN');
  const rose = byName.get('ローズカフェ');

  console.log('■ 変更前\n');
  for (const s of shops.filter(x => !x.owner_id)) {
    console.log(`   ${s.name.padEnd(14)} オーナー未設定`);
  }
  if (rose) console.log(`   ${rose.name.padEnd(14)} オーナー = ${ownerName.get(rose.owner_id!) || '未設定'}`);
  console.log('');

  if (!onyanko || !ichigun || !rose) {
    console.log('★対象店舗が見つかりません。中止します。');
    process.exitCode = 1;
    return;
  }
  if (!rose.owner_id) {
    console.log('★ローズカフェにオーナーが設定されていません。中止します。');
    process.exitCode = 1;
    return;
  }

  console.log('■ 実行内容\n');

  // --- おニャンこスパ：単独グループを作って割り当てる ---
  if (onyanko.owner_id) {
    console.log(`   おニャンこスパ … 既に「${ownerName.get(onyanko.owner_id)}」に所属。変更なし`);
  } else {
    const GROUP = 'おニャンこスパ';
    const existing = (owners || []).find(o => o.name === GROUP);
    console.log(`   おニャンこスパ … グループ「${GROUP}」${existing ? '（既存を使用）' : 'を新規作成'}して割り当て`);
    if (!DRY_RUN) {
      let ownerId = existing?.id;
      if (!ownerId) {
        const { data: created, error: e } = await db
          .from('owners').insert([{ name: GROUP }]).select('id').single();
        if (e || !created) throw new Error(`グループ作成に失敗: ${e?.message}`);
        ownerId = created.id;
      }
      const { error: e2 } = await db.from('shops').update({ owner_id: ownerId }).eq('id', onyanko.id);
      if (e2) throw new Error(`おニャンこスパの更新に失敗: ${e2.message}`);
    }
  }

  // --- ICHIGUN：ローズカフェと同じグループへ ---
  if (ichigun.owner_id) {
    console.log(`   ICHIGUN      … 既に「${ownerName.get(ichigun.owner_id)}」に所属。変更なし`);
  } else {
    console.log(`   ICHIGUN      … ローズカフェと同じグループ「${ownerName.get(rose.owner_id)}」に割り当て`);
    if (!DRY_RUN) {
      const { error: e } = await db.from('shops').update({ owner_id: rose.owner_id }).eq('id', ichigun.id);
      if (e) throw new Error(`ICHIGUNの更新に失敗: ${e.message}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n（DRY_RUN のため何も変更していません）');
    return;
  }

  // --- 結果確認 ---
  const { data: after } = await db.from('shops').select('id, name, owner_id');
  const { data: ownersAfter } = await db.from('owners').select('id, name');
  const nameAfter = new Map((ownersAfter || []).map(o => [o.id, o.name]));
  const still = (after || []).filter(s => !s.owner_id);

  console.log('\n■ 変更後\n');
  console.log(`   オーナー未設定の店舗: ${still.length === 0 ? 'なし' : still.map(s => s.name).join(', ')}`);
  for (const s of (after || []).filter(s => ['おニャンこスパ', 'ICHIGUN', 'ローズカフェ'].includes(s.name))) {
    console.log(`   ${s.name.padEnd(14)} → ${nameAfter.get(s.owner_id!) || '未設定'}`);
  }

  // グループごとの店舗数
  const groups = new Map<string, string[]>();
  (after || []).forEach(s => {
    if (!s.owner_id) return;
    const k = nameAfter.get(s.owner_id) || s.owner_id;
    groups.set(k, [...(groups.get(k) || []), s.name]);
  });
  console.log('\n   複数店舗グループ:');
  [...groups.entries()].filter(([, v]) => v.length > 1)
    .forEach(([k, v]) => console.log(`      ${k}: ${v.join(' / ')}`));
}

main().catch(e => {
  console.error('失敗:', e.message);
  process.exitCode = 1;
});
