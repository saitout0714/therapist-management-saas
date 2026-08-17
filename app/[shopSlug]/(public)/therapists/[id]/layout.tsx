import type { Metadata } from 'next';
import {
  buildShopMetadata,
  buildBreadcrumbJsonLd,
  fetchShopSeo,
  fetchTherapistSeo,
  toMetaDescription,
} from '../../../../../lib/seo';

type LayoutParams = { params: Promise<{ shopSlug: string; id: string }> };

export async function generateMetadata({ params }: LayoutParams): Promise<Metadata> {
  const { shopSlug, id } = await params;
  const shop = await fetchShopSeo(shopSlug);

  if (!shop) {
    return buildShopMetadata(shopSlug, 'therapists');
  }

  const therapist = await fetchTherapistSeo(shop.id, id);

  // DBに実在しないID（モックデータのセラピスト等）では名前を推測せず、
  // 一覧ページ相当のメタデータにフォールバックする。
  if (!therapist) {
    return buildShopMetadata(shopSlug, 'therapists', { path: `/therapists/${id}` });
  }

  const suffix = shop.catchphrase ? `${shop.catchphrase} ${shop.name}` : shop.name;

  return buildShopMetadata(shopSlug, 'therapists', {
    path: `/therapists/${id}`,
    titleOverride: `${therapist.name}｜セラピスト紹介｜${suffix}`,
    descriptionOverride:
      toMetaDescription(therapist.comment) ??
      `${suffix}のセラピスト「${therapist.name}」のプロフィール・出勤スケジュール・ご予約はこちら。`,
  });
}

export default async function TherapistDetailLayout({
  children,
  params,
}: { children: React.ReactNode } & LayoutParams) {
  const { shopSlug, id } = await params;
  const shop = await fetchShopSeo(shopSlug);
  const therapist = shop ? await fetchTherapistSeo(shop.id, id) : null;

  return (
    <>
      {shop && shop.hasHp && therapist && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildBreadcrumbJsonLd(shop, [
                { name: 'セラピスト一覧', path: '/therapists' },
                { name: therapist.name, path: `/therapists/${id}` },
              ])
            ).replace(/</g, '\\u003c'),
          }}
        />
      )}
      {children}
    </>
  );
}
