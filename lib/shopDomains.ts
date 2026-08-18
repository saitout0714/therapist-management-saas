/**
 * 独自ドメイン関連の定義。
 *
 * middleware.ts（Edgeランタイム）と lib/seo.ts の両方から読むため、
 * このファイルは依存を一切持たない。Supabaseクライアント等を
 * import すると middleware のバンドルに載ってしまうので追加しないこと。
 */

/** 独自ドメイン -> 店舗slug。middlewareのリライトと canonical / sitemap が共用する。 */
export const SHOP_DOMAIN_MAP: Record<string, string> = {
  'specialgrade.jp': 'specialgrade',
  'www.specialgrade.jp': 'specialgrade',
  'specialgrade.local': 'specialgrade',
  'onyankospa.com': 'onyankospa',
  'www.onyankospa.com': 'onyankospa',
};

/** SaaS本体のオリジン（独自ドメイン未設定の店舗はこの配下が正規URLになる） */
export const SAAS_ORIGIN = 'https://yoyakl.tokyo';

/**
 * 店舗slug -> 正規URLのオリジン。
 * ここに載せた店舗は canonical / sitemap が独自ドメイン側に統一される。
 *
 * 【重要】DNSが有効になっていないドメインを追加してはいけない。
 * 到達できないドメインを canonical に指定すると、そのページは
 * インデックスされなくなる。
 * specialgrade.jp は現時点でDNS未設定のため、あえて載せていない。
 */
export const SHOP_CANONICAL_ORIGIN: Record<string, string> = {
  onyankospa: 'https://onyankospa.com',
};

/**
 * 店舗ページ内部リンク（ヘッダー/フッター/セラピストカード等）の先頭パスを決める。
 *
 * 独自ドメイン（onyankospa.com 等）でアクセスされている場合、middleware が
 * サーバー側で `/[shopSlug]` へリライトしているため、リンク自体には店舗slugを
 * 含めてはいけない（含めるとURLバーに `onyankospa.com/onyankospa/...` が
 * 現れてしまい、SaaS本体と独自ドメインでURLの一貫性が崩れる）。
 * SaaS本体（yoyakl.tokyo）ではこれまで通り `/${slug}` が必要。
 */
export function publicBasePath(hostname: string | null | undefined, slug: string): string {
  if (hostname && SHOP_DOMAIN_MAP[hostname]) return '';
  return `/${slug}`;
}
