import type { Metadata } from 'next';
import {
  buildShopMetadata,
  buildBreadcrumbJsonLd,
  fetchShopSeo,
  fetchNewsSeo,
  toMetaDescription,
} from '../../../../../lib/seo';

type LayoutParams = { params: Promise<{ shopSlug: string; id: string }> };

export async function generateMetadata({ params }: LayoutParams): Promise<Metadata> {
  const { shopSlug, id } = await params;
  const shop = await fetchShopSeo(shopSlug);

  if (!shop) {
    return buildShopMetadata(shopSlug, 'news');
  }

  const article = await fetchNewsSeo(shop.id, id);

  // DBに実在しない記事IDでは記事名を推測せず、一覧ページ相当のメタデータにフォールバックする。
  if (!article) {
    return buildShopMetadata(shopSlug, 'news', { path: `/news/${id}` });
  }

  const suffix = shop.catchphrase ? `${shop.catchphrase} ${shop.name}` : shop.name;

  return buildShopMetadata(shopSlug, 'news', {
    path: `/news/${id}`,
    titleOverride: `${article.title}｜新着情報｜${suffix}`,
    descriptionOverride: toMetaDescription(article.content) ?? `${suffix}の最新情報「${article.title}」。`,
    ogImageOverride: article.imageUrl,
  });
}

export default async function NewsDetailLayout({
  children,
  params,
}: { children: React.ReactNode } & LayoutParams) {
  const { shopSlug, id } = await params;
  const shop = await fetchShopSeo(shopSlug);
  const article = shop ? await fetchNewsSeo(shop.id, id) : null;

  return (
    <>
      {shop && shop.hasHp && article && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildBreadcrumbJsonLd(shop, [
                { name: '新着情報', path: '/news' },
                { name: article.title, path: `/news/${id}` },
              ])
            ).replace(/</g, '\\u003c'),
          }}
        />
      )}
      {children}
    </>
  );
}
