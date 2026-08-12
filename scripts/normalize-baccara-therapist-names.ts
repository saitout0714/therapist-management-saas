/**
 * バカラのセラピスト名から、ローマ字表記と括弧を取り除く。
 *   「Hirano Rin（ヒラノ リン）」 → 「ヒラノ リン」
 *
 * 括弧の中身（カナ）を採用する。括弧が無い名前はそのまま。
 * 全角・半角どちらの括弧にも対応する。
 *
 * DRY_RUN=1 で変換結果の一覧のみ表示（既定）。APPLY=1 で実行。
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APPLY = process.env.APPLY === '1';

/**
 * 括弧の中身が漢字などカナ以外だった1件。オーナー指定でカナに置き換える。
 * 括弧内の文字列をそのまま採用できないケースはここに追加する。
 */
const OVERRIDES: Record<string, string> = {
  '叶やよい子': 'カノウ ヤヨイコ',
};

/** 括弧の中身を取り出す。括弧が無ければ null */
function extractParen(name: string): string | null {
  const m = String(name).match(/[（(]\s*([^）)]+?)\s*[）)]\s*$/);
  if (!m) return null;
  const inner = m[1].trim();
  return inner.length > 0 ? inner : null;
}

/** 全角スペースを半角に揃え、連続する空白を1つにまとめる */
function normalizeSpaces(s: string): string {
  return s.replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
}

/** 最終的な表示名を決める */
function toDisplayName(name: string): string | null {
  const inner = extractParen(name);
  if (!inner) return null;
  const mapped = OVERRIDES[inner] ?? inner;
  const result = normalizeSpaces(mapped);
  return result === name ? null : result;
}

async function main() {
  const { data: shops } = await db.from('shops').select('id, name').like('name', 'バカラ%');
  const shopName = new Map((shops || []).map(s => [s.id, s.name]));
  const shopIds = (shops || []).map(s => s.id);

  const { data: therapists } = await db
    .from('therapists')
    .select('id, name, shop_id, is_active')
    .in('shop_id', shopIds)
    .order('name');

  const changes: { id: string; from: string; to: string; shop: string }[] = [];
  const untouched: string[] = [];

  for (const t of therapists || []) {
    const next = toDisplayName(t.name);
    if (!next) {
      untouched.push(`${t.name}（${shopName.get(t.shop_id)}）`);
      continue;
    }
    changes.push({ id: t.id, from: t.name, to: next, shop: shopName.get(t.shop_id) || '?' });
  }

  console.log(`■ 変換する ${changes.length}件\n`);
  changes.forEach(c =>
    console.log(`   ${String(c.shop).padEnd(14)} ${c.from.padEnd(36)} → ${c.to}`)
  );

  if (untouched.length > 0) {
    console.log(`\n■ そのままにする ${untouched.length}件（括弧が無い）\n`);
    untouched.forEach(n => console.log(`   ${n}`));
  }

  // 変換後に同じ名前になるものが無いか
  const after = new Map<string, string[]>();
  (therapists || []).forEach(t => {
    const finalName = toDisplayName(t.name) ?? t.name;
    after.set(finalName, [...(after.get(finalName) || []), `${t.name}(${shopName.get(t.shop_id)})`]);
  });
  const dup = [...after.entries()].filter(([, v]) => v.length > 1);
  console.log(`\n■ 変換後に同名になる組み合わせ\n`);
  if (dup.length === 0) console.log('   なし');
  else dup.forEach(([k, v]) => console.log(`   ★「${k}」: ${v.join(' / ')}`));

  if (!APPLY) {
    console.log('\n（確認のみ。実行するには APPLY=1 を付けてください）');
    return;
  }

  let done = 0;
  for (const c of changes) {
    const { error } = await db.from('therapists').update({ name: c.to }).eq('id', c.id);
    if (error) throw new Error(`${c.from} の更新に失敗: ${error.message}`);
    done++;
  }
  console.log(`\n■ 完了：${done}件を更新しました`);
}

main().catch(e => {
  console.error('失敗:', e.message);
  process.exitCode = 1;
});
