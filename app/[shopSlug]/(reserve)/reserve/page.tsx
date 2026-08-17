import { redirect } from 'next/navigation';

// 旧・簡易予約フォームは廃止。全店舗、こころリンスと同一仕様の本番予約エンジン
// （/reserve/[code]）へ一本化したため、このURLへのアクセス（ブックマーク等）は
// 予約コード付きのURLへリダイレクトする。予約コードは店舗slugと同一の値で運用する。
export default async function ReservePageRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string }>;
  searchParams?: Promise<{ therapistId?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const therapistId = resolvedSearchParams?.therapistId;

  const query = therapistId ? `?therapist_id=${encodeURIComponent(therapistId)}` : '';
  redirect(`/reserve/${shopSlug}${query}`);
}
