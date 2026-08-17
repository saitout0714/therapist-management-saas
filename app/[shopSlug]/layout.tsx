import { notFound } from 'next/navigation';
import { fetchShopSeo } from '../../lib/seo';

/**
 * [shopSlug] 配下のルート検証。
 *
 * これが無いと [shopSlug] が任意のパスを拾ってしまい、
 * /存在しないURL や /wp-admin, /.env までが HTTP 200 で
 * （fetchStoreConfig のフォールバックにより）他店の内容を返していた。
 * クロールバジェットの浪費とソフト404・重複コンテンツの原因になるため、
 * DBに実在しない店舗セグメントは 404 を返す。
 */
export default async function ShopSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  const shop = await fetchShopSeo(shopSlug);

  if (!shop) {
    notFound();
  }

  return children;
}
