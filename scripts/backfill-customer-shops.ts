/**
 * Phase 3 先行対応：全顧客に owner_id を設定し、customer_shops へ
 * 「今の店舗・今の会員番号」を写す。
 *
 * customers は今のところ「1店舗1レコード」なので、まだ誰も統合していない。
 * ここでは重複の統合はせず、今ある customers 行1件につき customer_shops 行を
 * 1件作るだけ（在籍店舗が今の shop_id だけの状態）。
 * これで既存の会員番号（今日追加した member_number 列の値）が失われず、
 * 新しい構造の土台に写る。
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
  const shops = await fetchAll('shops', 'id, owner_id');
  const ownerOf = new Map(shops.map(s => [s.id, s.owner_id]));

  const customers = await fetchAll('customers', 'id, shop_id, owner_id, member_number');
  const existingCS = await fetchAll('customer_shops', 'customer_id, shop_id');
  const haveRoster = new Set(existingCS.map(r => `${r.customer_id}::${r.shop_id}`));

  const ownerFixes = customers.filter(c => c.shop_id && ownerOf.get(c.shop_id) && c.owner_id !== ownerOf.get(c.shop_id));
  const rosterInserts = customers
    .filter(c => c.shop_id && !haveRoster.has(`${c.id}::${c.shop_id}`))
    .map(c => ({ customer_id: c.id, shop_id: c.shop_id, member_number: c.member_number || null }));

  console.log('■ 実行内容\n');
  console.log(`   owner_id を設定/修正 : ${ownerFixes.length}件`);
  console.log(`   customer_shops を新規作成 : ${rosterInserts.length}件`);

  if (DRY_RUN) {
    console.log('\n（DRY_RUN のため何も変更していません）');
    return;
  }

  for (let i = 0; i < ownerFixes.length; i += 500) {
    const chunk = ownerFixes.slice(i, i + 500);
    for (const c of chunk) {
      const { error } = await db.from('customers').update({ owner_id: ownerOf.get(c.shop_id) }).eq('id', c.id);
      if (error) throw new Error(`顧客 ${c.id} の owner_id 更新に失敗: ${error.message}`);
    }
    console.log(`   owner_id: ${Math.min(i + 500, ownerFixes.length)} / ${ownerFixes.length} 件処理`);
  }

  for (let i = 0; i < rosterInserts.length; i += 500) {
    const chunk = rosterInserts.slice(i, i + 500);
    const { error } = await db.from('customer_shops').insert(chunk);
    if (error) throw new Error(`customer_shops の作成に失敗: ${error.message}`);
    console.log(`   customer_shops: ${Math.min(i + 500, rosterInserts.length)} / ${rosterInserts.length} 件処理`);
  }

  const after = await fetchAll('customer_shops', 'customer_id');
  console.log(`\n■ 変更後\n   customer_shops の行数: ${after.length}行 / customers総数: ${customers.length}件`);
}

main().catch(e => {
  console.error('失敗:', e.message);
  process.exitCode = 1;
});
