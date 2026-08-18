import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SHOP_DOMAIN_MAP } from './lib/shopDomains';

/**
 * サイトのルート直下に存在しなければならないファイル。
 * これらを `/[shopSlug]/...` にリライトしてしまうと 404 になり、
 * 独自ドメインでは robots.txt / sitemap.xml が配信できなくなる
 * （= クローラがサイトマップを見つけられない）。
 */
const ROOT_ASSETS = new Set([
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/icon.png',
  '/apple-icon.png',
  '/manifest.json',
  '/manifest.webmanifest',
]);

function isRootAsset(pathname: string): boolean {
  if (ROOT_ASSETS.has(pathname)) return true;
  // sitemap.xml が分割された場合（/sitemap/0.xml 等）にも対応
  if (/^\/sitemap[-/][\w./-]*\.xml$/.test(pathname)) return true;
  // Google Search Console 等のドメイン所有権確認ファイル
  if (/^\/(google[0-9a-f]+\.html|\.well-known\/[\w./-]+)$/.test(pathname)) return true;
  // /public 配下の静的ファイル（/images/*.jpg, /logo.png 等）。
  // ページルートは拡張子を持たないため、拡張子付きパスは常にそのまま配信する。
  // これが無いと独自ドメインで /images/xxx.jpg が /[shopSlug]/images/xxx.jpg に
  // 書き換えられて404になり、画像が一枚も表示されなくなる。
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';

  // ドメインマッピングテーブル（独自ドメイン -> 店舗slug）は lib/shopDomains.ts と共用。
  // canonical / sitemap も同じ表を見るため、ここだけ更新して片方が古くなる事故を防ぐ。
  const matchedSlug = SHOP_DOMAIN_MAP[hostname];

  // パスがルート `/` や特定のページで独自ドメインアクセスの場合、`/[shopSlug]` へリライト
  //
  // `/reserve/[code]` は [shopSlug] 配下ではなくアプリのルート直下に存在する
  // 本番予約エンジンで、WEB予約ボタン等は全店舗共通で `/reserve/<slug>` に
  // 直接リンクしている。ここを除外しないと独自ドメイン上で
  // `/onyankospa/reserve/onyankospa` のように二重リライトされ、
  // WEB予約ボタンを押すと必ず404になる。
  if (
    matchedSlug &&
    !url.pathname.startsWith(`/${matchedSlug}`) &&
    !url.pathname.startsWith('/api') &&
    !url.pathname.startsWith('/_next') &&
    !url.pathname.startsWith('/reserve') &&
    !isRootAsset(url.pathname)
  ) {
    url.pathname = `/${matchedSlug}${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
