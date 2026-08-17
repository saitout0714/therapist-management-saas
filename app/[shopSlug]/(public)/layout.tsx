import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildShopMetadata, fetchShopSeo, buildLocalBusinessJsonLd } from '../../../lib/seo';

type LayoutParams = { params: Promise<{ shopSlug: string }> };

/**
 * 店舗公開ページ共通の metadata。
 * TOPページ（(public)/page.tsx）はこの layout の値をそのまま使い、
 * 下位ページはそれぞれの layout.tsx で上書きする。
 */
export async function generateMetadata({ params }: LayoutParams): Promise<Metadata> {
  const { shopSlug } = await params;
  return buildShopMetadata(shopSlug, 'top');
}

export default async function StorePublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
} & LayoutParams) {
  const { shopSlug } = await params;
  const shop = await fetchShopSeo(shopSlug);

  if (!shop) {
    notFound();
  }

  return (
    <>
      {/* ローカル検索向けの構造化データ。公開HP契約がある店舗のみ出力する。 */}
      {shop.hasHp && (
        <script
          type="application/ld+json"
          // 値はDB由来の静的な店舗情報のみ。JSON.stringify で </script> 混入を無害化する。
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildLocalBusinessJsonLd(shop)).replace(/</g, '\\u003c'),
          }}
        />
      )}
      {children}
    </>
  );
}
