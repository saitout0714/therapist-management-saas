import { cache } from 'react';
import type { Metadata } from 'next';
import { supabase } from './supabase';

import { SHOP_DOMAIN_MAP, SAAS_ORIGIN, SHOP_CANONICAL_ORIGIN } from './shopDomains';

// ドメイン定義は lib/shopDomains.ts に集約（middlewareのEdgeバンドルと共用するため）。
export { SHOP_DOMAIN_MAP, SAAS_ORIGIN, SHOP_CANONICAL_ORIGIN };

/** OGP画像（1200x630推奨）。logo_url が未設定の店舗向けの指定。 */
const SHOP_OG_IMAGE: Record<string, string> = {
  // onyanko_mainvisual.jpg（1264x843）は1.91:1でないためSNSシェア時に上下が
  // 切れていた。1200x630にクロップ済みの専用画像に差し替え。
  onyankospa: '/images/onyanko_og_image.jpg',
};

/** Google Search Console のHTMLタグ確認用コード（content属性の値のみ）。 */
const SHOP_GOOGLE_SITE_VERIFICATION: Record<string, string> = {
  onyankospa: 'w8P60bwofIXrWSNhKuV5cQmLhi6gCF52syAy8aFaBMM',
};

export type ShopPageKey =
  | 'top'
  | 'therapists'
  | 'schedule'
  | 'system'
  | 'access'
  | 'recruit'
  | 'diary'
  | 'news';

/** ページキー -> [URLパス, 見出しラベル] */
const PAGE_DEFS: Record<ShopPageKey, { path: string; label: string | null }> = {
  top: { path: '', label: null },
  therapists: { path: '/therapists', label: 'セラピスト一覧' },
  schedule: { path: '/schedule', label: '出勤スケジュール' },
  system: { path: '/system', label: 'システム・料金' },
  access: { path: '/access', label: 'アクセス・店舗案内' },
  recruit: { path: '/recruit', label: 'セラピスト求人' },
  diary: { path: '/diary', label: '写メ日記' },
  news: { path: '/news', label: '新着情報' },
};

export interface ShopSeo {
  id: string;
  slug: string;
  /** URL上のセグメント（slug未設定の店舗は店名がそのままURLになっているため区別する） */
  urlSegment: string;
  name: string;
  catchphrase: string | null;
  description: string | null;
  address: string | null;
  accessInfo: string | null;
  businessHours: string | null;
  phone: string | null;
  googleMapUrl: string | null;
  logoUrl: string | null;
  xUrl: string | null;
  /** 公開HP契約フラグ。false の店舗は noindex にして検索結果に出さない。 */
  hasHp: boolean;
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * 公開HPのルート検証・メタデータ生成用の店舗取得。
 *
 * fetchStoreConfig() との決定的な違いは、**見つからなければ null を返す**こと。
 * fetchStoreConfig() はモック店舗(Special Grade)にフォールバックするため、
 * /存在しないURL が HTTP 200 で他店の内容を返してしまっていた（ソフト404・重複コンテンツ）。
 *
 * 解決順は fetchStoreConfig() と揃えてあるので、
 * slug が未設定で店名でアクセスされている既存店舗のURLは壊れない。
 *
 * cache() で同一リクエスト内の重複クエリを排除している
 * （generateMetadata と layout 本体の両方から呼ばれるため）。
 */
export const fetchShopSeo = cache(async (segment: string): Promise<ShopSeo | null> => {
  const decoded = (() => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  })();

  const columns =
    'id, slug, name, catchphrase, description, address, access_info, business_hours, phone, google_map_url, logo_url, x_url, has_hp, is_active';

  let row: Record<string, unknown> | null = null;

  const bySlug = await supabase.from('shops').select(columns).eq('slug', decoded).maybeSingle();
  row = bySlug.data as Record<string, unknown> | null;

  if (!row) {
    const byName = await supabase.from('shops').select(columns).ilike('name', decoded).maybeSingle();
    row = byName.data as Record<string, unknown> | null;
  }

  if (!row && looksLikeUuid(decoded)) {
    const byId = await supabase.from('shops').select(columns).eq('id', decoded).maybeSingle();
    row = byId.data as Record<string, unknown> | null;
  }

  if (!row || row.is_active === false) return null;

  return {
    id: String(row.id),
    slug: (row.slug as string) || decoded,
    urlSegment: segment,
    name: (row.name as string) || decoded,
    catchphrase: normalizeSpaces(row.catchphrase as string | null),
    description: (row.description as string | null) || null,
    address: (row.address as string | null) || null,
    accessInfo: (row.access_info as string | null) || null,
    businessHours: (row.business_hours as string | null) || null,
    phone: (row.phone as string | null) || null,
    googleMapUrl: (row.google_map_url as string | null) || null,
    logoUrl: (row.logo_url as string | null) || null,
    xUrl: (row.x_url as string | null) || null,
    hasHp: row.has_hp !== false,
  };
});

/** 全角スペース・連続スペースを半角1つに畳む（catchphrase が "大塚　メンズエステ" のような表記のため） */
function normalizeSpaces(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/[\s　]+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

/** meta description / og:description 用に改行を畳んで指定文字数で切る */
export function toMetaDescription(source: string | null | undefined, limit = 120): string | null {
  const flat = normalizeSpaces(source);
  if (!flat) return null;
  if (flat.length <= limit) return flat;
  return `${flat.slice(0, limit - 1)}…`;
}

/** 店舗ページの正規URLを組み立てる */
export function shopCanonicalUrl(shop: ShopSeo, path = ''): string {
  const origin = SHOP_CANONICAL_ORIGIN[shop.slug];
  if (origin) return `${origin}${path}`;
  return `${SAAS_ORIGIN}/${shop.urlSegment}${path}`;
}

/** 「地域＋業種」を先頭に置いたタイトル用の接尾辞。catchphrase が無ければ店名のみ。 */
function shopTitleSuffix(shop: ShopSeo): string {
  return shop.catchphrase ? `${shop.catchphrase} ${shop.name}` : shop.name;
}

/**
 * 店舗公開ページの metadata を組み立てる。
 * 各ページの layout.tsx から呼ぶ（ページ本体は 'use client' のため
 * generateMetadata を直接エクスポートできない）。
 */
export async function buildShopMetadata(
  segment: string,
  page: ShopPageKey,
  extra?: { titleOverride?: string; descriptionOverride?: string; path?: string; ogImageOverride?: string | null }
): Promise<Metadata> {
  const shop = await fetchShopSeo(segment);

  // 店舗が引けない場合はここでは404にしない（layout側の notFound() に任せる）。
  if (!shop) {
    return { title: 'ページが見つかりません', robots: { index: false, follow: false } };
  }

  const def = PAGE_DEFS[page];
  const path = extra?.path ?? def.path;

  const title =
    extra?.titleOverride ??
    (def.label
      ? `${def.label}｜${shopTitleSuffix(shop)}`
      : shop.catchphrase
        ? `${shop.catchphrase}｜${shop.name}【公式】`
        : `${shop.name}【公式】`);

  const description =
    extra?.descriptionOverride ??
    toMetaDescription(shop.description) ??
    toMetaDescription(
      [shopTitleSuffix(shop), shop.accessInfo, shop.businessHours ? `営業時間 ${shop.businessHours}` : null]
        .filter(Boolean)
        .join('。')
    ) ??
    shop.name;

  const canonical = shopCanonicalUrl(shop, path);
  const ogImage = extra?.ogImageOverride ?? (shop.logoUrl || SHOP_OG_IMAGE[shop.slug]);
  const googleSiteVerification = SHOP_GOOGLE_SITE_VERIFICATION[shop.slug];

  return {
    metadataBase: new URL(SHOP_CANONICAL_ORIGIN[shop.slug] || SAAS_ORIGIN),
    title,
    description,
    alternates: { canonical },
    // 公開HP契約が無い店舗は検索結果に出さない
    robots: shop.hasHp
      ? { index: true, follow: true }
      : { index: false, follow: false },
    ...(googleSiteVerification ? { verification: { google: googleSiteVerification } } : {}),
    openGraph: {
      type: 'website',
      siteName: shop.name,
      title,
      description,
      url: canonical,
      locale: 'ja_JP',
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: shop.name }] } : {}),
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

/**
 * "11:00〜28:00 (受付 10:00〜26:00)" のような表記から schema.org の openingHours を作る。
 * 24時以降の深夜表記は翌日の時刻に正規化する（28:00 -> 04:00）。
 * 解釈できない場合は null を返し、JSON-LD からは openingHours を省く。
 */
export function parseOpeningHours(businessHours: string | null | undefined): string | null {
  if (!businessHours) return null;
  const match = businessHours.match(/(\d{1,2}):(\d{2})\s*[〜~\-–ー]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const normalizeHour = (raw: string): string | null => {
    const hour = Number(raw);
    if (!Number.isFinite(hour) || hour < 0 || hour > 47) return null;
    return String(hour % 24).padStart(2, '0');
  };

  const openHour = normalizeHour(match[1]);
  const closeHour = normalizeHour(match[3]);
  if (openHour === null || closeHour === null) return null;

  return `Mo-Su ${openHour}:${match[2]}-${closeHour}:${match[4]}`;
}

/**
 * ローカル検索（「大塚 メンズエステ」等）で効く構造化データ。
 * エステ業なので LocalBusiness のサブタイプ HealthAndBeautyBusiness を使う。
 */
export function buildLocalBusinessJsonLd(shop: ShopSeo): Record<string, unknown> {
  const url = shopCanonicalUrl(shop);
  const openingHours = parseOpeningHours(shop.businessHours);
  const ogImage = shop.logoUrl || SHOP_OG_IMAGE[shop.slug];
  const sameAs = [shop.xUrl].filter((v): v is string => Boolean(v));

  return {
    '@context': 'https://schema.org',
    '@type': 'HealthAndBeautyBusiness',
    '@id': `${url}#business`,
    name: shop.name,
    url,
    ...(shop.catchphrase ? { slogan: shop.catchphrase } : {}),
    ...(shop.description ? { description: normalizeSpaces(shop.description) } : {}),
    ...(ogImage ? { image: ogImage.startsWith('http') ? ogImage : `${url}${ogImage}` } : {}),
    ...(shop.phone ? { telephone: shop.phone } : {}),
    ...(shop.address
      ? {
          address: {
            '@type': 'PostalAddress',
            addressCountry: 'JP',
            streetAddress: shop.address,
          },
        }
      : {}),
    ...(openingHours ? { openingHours } : {}),
    ...(shop.googleMapUrl ? { hasMap: shop.googleMapUrl } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    priceRange: '¥¥',
    areaServed: shop.catchphrase || shop.address || undefined,
  };
}

/** パンくずの構造化データ */
export function buildBreadcrumbJsonLd(
  shop: ShopSeo,
  trail: { name: string; path: string }[]
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: shop.name, path: '' }, ...trail].map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: shopCanonicalUrl(shop, item.path),
    })),
  };
}

export interface TherapistSeo {
  id: string;
  name: string;
  comment: string | null;
  photoUrl: string | null;
}

/**
 * セラピスト詳細ページの metadata 用。
 * storeApi の fetchTherapistDetail() はモックにフォールバックして
 * 別人の名前を返し得るため、メタデータには使わず厳格に引く。
 */
export const fetchTherapistSeo = cache(
  async (shopId: string, therapistId: string): Promise<TherapistSeo | null> => {
    if (!looksLikeUuid(therapistId)) return null;

    const { data } = await supabase
      .from('therapists')
      .select('id, name, comment, photo_url, shop_id, is_active')
      .eq('id', therapistId)
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .maybeSingle();

    if (!data) return null;

    return {
      id: String(data.id),
      name: (data.name as string) || '',
      comment: (data.comment as string | null) || null,
      photoUrl: (data.photo_url as string | null) || null,
    };
  }
);

export interface NewsSeo {
  id: string;
  title: string;
  content: string;
  category: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
}

/** ニュース詳細ページの metadata 用。他店舗の記事を誤って返さないよう shop_id で絞る。 */
export const fetchNewsSeo = cache(
  async (shopId: string, newsId: string): Promise<NewsSeo | null> => {
    if (!looksLikeUuid(newsId)) return null;

    const { data } = await supabase
      .from('news_items')
      .select('*')
      .eq('id', newsId)
      .eq('shop_id', shopId)
      .maybeSingle();

    if (!data) return null;

    return {
      id: String(data.id),
      title: (data.title as string) || '',
      content: (data.content as string) || '',
      category: (data.category as string | null) || null,
      publishedAt: (data.published_at as string | null) || null,
      imageUrl: (data.image_url as string | null) || null,
    };
  }
);

/** 公開HPを持つ（=sitemapに載せる）店舗の一覧 */
export async function fetchIndexableShops(): Promise<ShopSeo[]> {
  const { data } = await supabase
    .from('shops')
    .select(
      'id, slug, name, catchphrase, description, address, access_info, business_hours, phone, google_map_url, logo_url, x_url, has_hp, is_active'
    )
    .eq('is_active', true)
    .eq('has_hp', true);

  if (!data) return [];

  return data
    .filter((row: Record<string, unknown>) => Boolean(row.slug || row.name))
    .map((row: Record<string, unknown>) => ({
      id: String(row.id),
      slug: (row.slug as string) || (row.name as string),
      urlSegment: (row.slug as string) || (row.name as string),
      name: (row.name as string) || '',
      catchphrase: normalizeSpaces(row.catchphrase as string | null),
      description: (row.description as string | null) || null,
      address: (row.address as string | null) || null,
      accessInfo: (row.access_info as string | null) || null,
      businessHours: (row.business_hours as string | null) || null,
      phone: (row.phone as string | null) || null,
      googleMapUrl: (row.google_map_url as string | null) || null,
      logoUrl: (row.logo_url as string | null) || null,
      xUrl: (row.x_url as string | null) || null,
      hasHp: true,
    }));
}
