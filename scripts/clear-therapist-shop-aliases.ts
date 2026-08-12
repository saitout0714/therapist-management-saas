/**
 * therapist_shops.alias_name（店舗別源氏名）をすべて空にする。
 *
 * 設定されていた14件はいずれも意図的な使い分けではなく、
 * 過去に全店舗へ登録した際の入力揺れだった（括弧の全角半角、カタカナ/漢字、
 * ローマ字の打ち間違い、基本名と同一のもの）。オーナー確認済み。
 *
 * 行そのものは削除しない。alias_name を NULL にするだけ。
 * 行は将来 Phase 2 で「在籍」を表す器として使うため、消すと情報が失われる。
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

async function main() {
  const { data: shops } = await db.from('shops').select('id, name');
  const shopName = new Map((shops || []).map(s => [s.id, s.name]));

  const { data: rows, error } = await db
    .from('therapist_shops')
    .select('therapist_id, shop_id, alias_name')
    .not('alias_name', 'is', null);
  if (error) throw error;

  const target = (rows || []).filter(r => r.alias_name && r.alias_name.trim());
  if (target.length === 0) {
    console.log('源氏名が設定されている行はありません。処理不要です。');
    return;
  }

  const { data: therapists } = await db
    .from('therapists')
    .select('id, name')
    .in('id', target.map(r => r.therapist_id));
  const baseName = new Map((therapists || []).map(t => [t.id, t.name]));

  console.log(`■ 対象 ${target.length}件\n`);
  console.log('   店舗            消される源氏名                        表示はこう変わる');
  console.log('   ' + '-'.repeat(88));
  for (const r of target) {
    const base = baseName.get(r.therapist_id) || '(不明)';
    const changes = base !== r.alias_name;
    console.log(
      '   ' + String(shopName.get(r.shop_id)).padEnd(14) +
      String(r.alias_name).padEnd(36) +
      (changes ? `→ ${base}` : '（基本名と同じ。見た目は変わらない）')
    );
  }

  if (DRY_RUN) {
    console.log('\n（DRY_RUN のため何も変更していません）');
    return;
  }

  let cleared = 0;
  for (const r of target) {
    const { error: e } = await db
      .from('therapist_shops')
      .update({ alias_name: null })
      .eq('therapist_id', r.therapist_id)
      .eq('shop_id', r.shop_id);
    if (e) throw new Error(`${shopName.get(r.shop_id)} の更新に失敗: ${e.message}`);
    cleared++;
  }

  // --- 結果確認 ---
  const { data: after } = await db
    .from('therapist_shops')
    .select('therapist_id, alias_name')
    .not('alias_name', 'is', null);
  const remaining = (after || []).filter(r => r.alias_name && r.alias_name.trim());
  const { count: totalRows } = await db
    .from('therapist_shops')
    .select('therapist_id', { count: 'exact', head: true });

  console.log('\n■ 変更後\n');
  console.log(`   空にした源氏名        : ${cleared}件`);
  console.log(`   残っている源氏名      : ${remaining.length}件`);
  console.log(`   therapist_shops の行数: ${totalRows}行（行は消していないので変わらないこと）`);
}

main().catch(e => {
  console.error('失敗:', e.message);
  process.exitCode = 1;
});
