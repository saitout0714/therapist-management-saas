import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // ログインページとログイン用のAPIは認証不要
  if (request.nextUrl.pathname === '/login') {
    return NextResponse.next()
  }

  // ローカルストレージから認証情報を確認できないため、
  // クッキーまたはヘッダーで認証状態をチェック
  const authUser = request.cookies.get('auth_user')

  // 未認証の場合はログインページへリダイレクト
  if (!authUser) {
    const loginUrl = new URL('/login', request.url)
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
     * - favicon.ico (favicon file)
     * - login (ログインページ)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login).*)',
  ],
}
