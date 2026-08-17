import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { supabase } from '../lib/supabase';
import {
  SHOP_DOMAIN_MAP,
  SHOP_CANONICAL_ORIGIN,
  fetchIndexableShops,
  fetchShopSeo,
  shopCanonicalUrl,
  type ShopSeo,
} from '../lib/seo';

/** sitemap に載せる固定ページ。/diary は機能未完成のため除外。 */
const STATIC_PATHS: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
  { path: '', priority: 1.0, changeFrequency: 'daily' },
  { path: '/therapists', priority: 0.9, changeFrequency: 'daily' },
  { path: '/schedule', priority: 0.9, changeFrequency: 'daily' },
  { path: '/system', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/access', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/recruit', priority: 0.5, changeFrequency: 'monthly' },
];

async function entriesForShop(shop: ShopSeo, lastModified: Date): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((page) => ({
    url: shopCanonicalUrl(shop, page.path),
    lastModified,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  // therapists テーブルに updated_at は無いので created_at を使う。
  const { data } = await supabase
    .from('therapists')
    .select('id, created_at')
    .eq('shop_id', shop.id)
    .eq('is_active', true);

  for (const therapist of data || []) {
    entries.push({
      url: shopCanonicalUrl(shop, `/therapists/${therapist.id}`),
      lastModified: therapist.created_at ? new Date(therapist.created_at as string) : lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get('host') || '';
  const now = new Date();

  // 店舗の独自ドメイン: その店舗のURLのみを列挙する。
  const mappedSlug = SHOP_DOMAIN_MAP[host];
  if (mappedSlug) {
    const shop = await fetchShopSeo(mappedSlug);
    if (!shop || !shop.hasHp) return [];
    return entriesForShop(shop, now);
  }

  // SaaS本体 (yoyakl.tokyo): 独自ドメインを持つ店舗は
  // そのドメイン側の sitemap が担当するので、ここでは重複させない。
  const shops = await fetchIndexableShops();
  const entries: MetadataRoute.Sitemap = [];

  for (const shop of shops) {
    if (SHOP_CANONICAL_ORIGIN[shop.slug]) continue;
    entries.push(...(await entriesForShop(shop, now)));
  }

  return entries;
}
