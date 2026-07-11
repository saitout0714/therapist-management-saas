import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  // 認証不要なパス（ログインページ・公開予約ページ）
  if (pathname === '/login' || pathname.startsWith('/reserve/')) {
    return NextResponse.next()
  }

  // ローカルストレージから認証情報を確認できないため、
  // クッキーまたはヘッダーで認証状態をチェック
  const authUser = request.cookies.get('auth_user')

  // 未認証の場合はログインページへリダイレクト
  if (!authUser) {
    const loginUrl = new URL('/login', request.url)
    const redirectUrl = pathname + request.nextUrl.search
    loginUrl.searchParams.set('redirect', redirectUrl)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * 以下のパス以外すべてに認証を必須にする:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - static files with extensions (e.g. logo.png, favicon.ico)
     * - login (ログインページ)
     * - reserve (公開予約ページ)
     */
    '/((?!api|_next/static|_next/image|.*\\..*|login|reserve).*)',
  ],
}
