import type { Metadata } from 'next';
import { buildShopMetadata } from '../../../../lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}): Promise<Metadata> {
  const { shopSlug } = await params;
  return buildShopMetadata(shopSlug, 'system');
}

export default function SystemLayout({ children }: { children: React.ReactNode }) {
  return children;
}
