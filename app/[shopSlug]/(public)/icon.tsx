/**
 * 店舗ごとのfavicon。
 *
 * app/favicon.ico はSaaS共通(YOYAKLブランド)のため、ここで店舗専用のものに
 * 差し替える。metadata.icons では app/favicon.ico の <link> と共存してしまい
 * ブラウザによって採用される方が不定になるため、あえてセグメント専用の
 * icon 特殊ファイルとして実装している（こちらはルート側を確実に上書きする）。
 * カスタムfaviconが無い店舗はSaaS共通のfavicon.icoにリダイレクトする。
 */

const SHOP_ICON_SVG: Record<string, string> = {
  onyankospa: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ff6fb5"/>
      <stop offset="50%" stop-color="#ff9fdd"/>
      <stop offset="100%" stop-color="#cf82d8"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="#150e20"/>
  <rect width="64" height="64" rx="14" fill="url(#g)" fill-opacity="0.92"/>
  <path d="M16 26 L12 10 L28 22 Z" fill="#150e20"/>
  <path d="M48 26 L52 10 L36 22 Z" fill="#150e20"/>
  <circle cx="32" cy="36" r="17" fill="#fdf6fb"/>
  <circle cx="25.5" cy="34" r="2.4" fill="#150e20"/>
  <circle cx="38.5" cy="34" r="2.4" fill="#150e20"/>
  <path d="M30.4 41 L33.6 41 L32 43.4 Z" fill="#ff6fb5"/>
  <path d="M14 38 L23 39.5 M14 44 L23 42.5 M50 38 L41 39.5 M50 44 L41 42.5" stroke="#150e20" stroke-width="1.4" stroke-linecap="round"/>
</svg>`,
};

export default async function Icon({ params }: { params: Promise<{ shopSlug: string }> }) {
  const { shopSlug } = await params;
  const svg = SHOP_ICON_SVG[shopSlug];

  if (!svg) {
    return new Response(null, { status: 302, headers: { Location: '/favicon.ico' } });
  }

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
