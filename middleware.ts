import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';

  // ドメインマッピングテーブル（例: 独自ドメイン -> 店舗slug）
  const domainMap: Record<string, string> = {
    'specialgrade.jp': 'specialgrade',
    'www.specialgrade.jp': 'specialgrade',
    'specialgrade.local': 'specialgrade',
    'onyankospa.com': 'onyankospa',
    'www.onyankospa.com': 'onyankospa',
  };

  const matchedSlug = domainMap[hostname];

  // パスがルート `/` や特定のページで独自ドメインアクセスの場合、`/[shopSlug]` へリライト
  if (matchedSlug && !url.pathname.startsWith(`/${matchedSlug}`) && !url.pathname.startsWith('/api') && !url.pathname.startsWith('/_next')) {
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
