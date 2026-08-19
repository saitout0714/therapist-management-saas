import type { NextConfig } from "next";
import dns from "node:dns";

/*
 * 一部のネットワーク環境（NAT64等）では外部ホスト名の名前解決が
 * 64:ff9b::/96 のIPv6アドレスを返すことがある。IPv4を優先させておく
 * （画像最適化のブロック自体は下の isPrivateIpEnvironment 対応で回避する）。
 */
dns.setDefaultResultOrder("ipv4first");

/*
 * Next.jsの画像最適化は、DNSが返した候補IPのうち1つでも「unicast」以外の
 * 特殊帯域（今回のNAT64合成アドレス等）を含むと、実際にそのIPへ接続するか
 * どうかに関係なく画像取得ごと拒否する。dns.setDefaultResultOrder による
 * 並び替えでは対象アドレス自体がリストから消えないため回避できない。
 *
 * 本番(Vercel等)のネットワークではこの現象は発生しないため、
 * ローカル開発時（NODE_ENV !== 'production'）に限り画像最適化を無効化し、
 * 元画像をそのまま表示する。本番の画像最適化・SSRF対策には一切影響しない。
 */
const isLocalDev = process.env.NODE_ENV !== 'production';

const nextConfig: any = {
  serverExternalPackages: ['playwright', 'playwright-core', '@sparticuz/chromium'],
  outputFileTracingIncludes: {
    '/api/**/*': [
      './node_modules/playwright-core/browsers.json',
      './node_modules/@sparticuz/chromium/bin/**/*',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/**',
      },
    ],
    /*
     * Vercelは /public のファイルを `max-age=0, must-revalidate` で配信する。
     * 画像最適化APIは元画像のこのヘッダを引き継ぐため、/_next/image の結果が
     * CDNに一切キャッシュされず（X-Vercel-Cache: MISS）、アクセスのたびに
     * リサイズと再エンコードが走ってLCPを押し上げていた。
     * アップロード画像のファイル名はタイムスタンプ（例 1787063135735.png）で、
     * 差し替えるとURL自体が変わるため長期キャッシュしても古い画像は残らない。
     */
    minimumCacheTTL: 2592000, // 30日
    ...(isLocalDev ? { unoptimized: true } : {}),
  },

  /*
   * /public 配下（背景・メインビジュアル等のテーマ画像）も既定では毎回
   * 再取得になるため、明示的にキャッシュさせる。
   * これらを差し替えるときはファイル名を変えること（ハッシュが付かないため）。
   */
  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800, stale-while-revalidate=2592000',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
