import type { Metadata } from 'next';
import { buildShopMetadata } from '../../../../lib/seo';
import { DIARY_FEATURE_ENABLED } from '../../../../lib/featureFlags';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}): Promise<Metadata> {
  const { shopSlug } = await params;
  const metadata = await buildShopMetadata(shopSlug, 'diary');

  // 写メ日記は機能が未完成（DIARY_FEATURE_ENABLED=false）。
  // ナビからは外れているが直リンクで到達できるため、中身の無いページが
  // インデックスされないよう noindex にする。フラグを true に戻せば自動で解除される。
  if (!DIARY_FEATURE_ENABLED) {
    return { ...metadata, robots: { index: false, follow: true } };
  }

  return metadata;
}

export default function DiaryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
