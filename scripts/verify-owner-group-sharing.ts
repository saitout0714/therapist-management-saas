/**
 * 料金・バックの参照先が、オーナー設定へ移行しても変わっていないことを確認する。
 *
 * 再実装ではなく lib/shopUtils.ts の本物の関数を通すので、
 * アプリが実際に使う経路と同じ結果を検証できる。
 * 期待値は shops.*_source_shop_id（旧方式・残してある）から計算する。
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import {
  getPricingShopId,
  getBackShopId,
  resolvePricingSourceShopId,
  resolveBackSourceShopId,
} from '../lib/shopUtils';

dotenv.config({ path: '.env.local' });

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await svc
    .from('shops')
    .select('id, name, pricing_source_shop_id, back_source_shop_id, owners(pricing_mode, pricing_base_shop_id, back_mode, back_base_shop_id)')
    .order('name');
  if (error) throw error;

  const shops = data as any[];
  const nameOf = new Map(shops.map(s => [s.id, s.name]));

  let ok = 0;
  const diffs: string[] = [];

  for (const s of shops) {
    // 旧方式（移行前の期待値）
    const expectedPricing = getPricingShopId({ id: s.id, pricing_source_shop_id: s.pricing_source_shop_id });
    const expectedBack = getBackShopId({ id: s.id, back_source_shop_id: s.back_source_shop_id });

    // 新方式（オーナー設定を解決してから同じ関数へ）。ShopContext と同じ流れ。
    const actualPricing = getPricingShopId({
      id: s.id,
      pricing_source_shop_id: resolvePricingSourceShopId(s.owners, null),
    });
    const actualBack = getBackShopId({
      id: s.id,
      back_source_shop_id: resolveBackSourceShopId(s.owners, null),
    });

    if (expectedPricing === actualPricing && expectedBack === actualBack) {
      ok++;
    } else {
      if (expectedPricing !== actualPricing)
        diffs.push(`${s.name} 料金: ${nameOf.get(expectedPricing)} → ${nameOf.get(actualPricing)}`);
      if (expectedBack !== actualBack)
        diffs.push(`${s.name} バック: ${nameOf.get(expectedBack)} → ${nameOf.get(actualBack)}`);
    }
  }

  console.log('■ 料金・バックの参照先\n');
  for (const s of shops) {
    const p = nameOf.get(getPricingShopId({ id: s.id, pricing_source_shop_id: resolvePricingSourceShopId(s.owners, null) }));
    const b = nameOf.get(getBackShopId({ id: s.id, back_source_shop_id: resolveBackSourceShopId(s.owners, null) }));
    const shared = p !== s.name || b !== s.name;
    if (shared) console.log(`   ${s.name}  料金→${p}  バック→${b}`);
  }
  console.log('   （上記以外はすべて自店のものを使用）\n');

  console.log('■ 移行前との突き合わせ\n');
  console.log(`   一致 : ${ok} / ${shops.length}`);
  console.log(`   相違 : ${diffs.length}`);
  diffs.forEach(d => console.log('      ' + d));

  console.log('\n■ 判定\n');
  if (diffs.length === 0) {
    console.log('   全店舗で一致。移行前と同じ料金・バック設定が使われている。');
  } else {
    console.log('   ★相違あり。切り替えてはいけない。');
    process.exitCode = 1;
  }
}

main().catch(e => {
  console.error('失敗:', e.message);
  process.exitCode = 1;
});
