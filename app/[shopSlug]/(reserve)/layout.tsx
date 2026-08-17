import type { Metadata } from 'next';
import { fetchShopSeo } from '../../../lib/seo';

/**
 * 予約フォームは検索流入させる意味がなく、
 * 日付・コース等のクエリ違いで無数のURLが生まれるため noindex にする。
 * （店名で見つけてもらう入口はTOPページ側が担う）
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}): Promise<Metadata> {
  const { shopSlug } = await params;
  const shop = await fetchShopSeo(shopSlug);

  return {
    title: shop ? `WEB予約｜${shop.name}` : 'WEB予約',
    description: shop
      ? `${shop.name}の24時間WEB予約フォームです。出勤中セラピストの空き枠からそのままご予約いただけます。`
      : undefined,
    robots: { index: false, follow: true },
  };
}

export default function ReserveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
