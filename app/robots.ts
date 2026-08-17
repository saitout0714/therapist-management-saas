import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { SHOP_DOMAIN_MAP, SAAS_ORIGIN, SHOP_CANONICAL_ORIGIN } from '../lib/seo';

/**
 * 管理画面のルート（app/(admin) 配下）。
 * ルートグループなのでURL上は "/" 直下に並ぶため、店舗ページの
 * /{slug}/therapists 等とは別物であることに注意（前方一致なので衝突しない）。
 */
const ADMIN_PATHS = [
  '/admin',
  '/login',
  '/aggregation',
  '/customers',
  '/memos',
  '/payroll',
  '/register-room',
  '/reservations',
  '/rooms',
  '/shifts',
  '/sync',
  '/system',
  '/therapists',
  '/users',
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host') || '';
  const shopSlug = SHOP_DOMAIN_MAP[host];

  // 店舗の独自ドメイン: 管理画面はそもそも到達できない（middlewareが /{slug}/... にリライトする）ため、
  // 予約フォームとAPIのみ除外する。
  if (shopSlug) {
    const origin = SHOP_CANONICAL_ORIGIN[shopSlug] || `https://${host}`;
    return {
      rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/reserve', '/therapist/login'] }],
      sitemap: `${origin}/sitemap.xml`,
      host: origin.replace(/^https?:\/\//, ''),
    };
  }

  // SaaS本体 (yoyakl.tokyo): 管理画面・予約フォームをまとめて除外する。
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/reserve', '/therapist/', ...ADMIN_PATHS],
      },
    ],
    sitemap: `${SAAS_ORIGIN}/sitemap.xml`,
  };
}
