import React from 'react';
import { TherapistDetailView } from '../../../../../components/store/TherapistDetailView';
import {
  fetchStoreConfig,
  fetchTherapistDetail,
  fetchBlogArticles,
  fetchConfirmedShifts,
  fetchBusinessDayCutoff,
  getJstBusinessDateStr,
} from '../../../../../lib/storeApi';
import { DIARY_FEATURE_ENABLED } from '../../../../../lib/featureFlags';

/**
 * サーバーコンポーネント。
 * セラピスト名・プロフィール・写真をHTMLに載せるため、取得をサーバー側に移した。
 * 表示部分（写真ギャラリーの選択状態を持つ）は TherapistDetailView に切り出している。
 */
export default async function TherapistDetailPage({
  params,
}: {
  params: Promise<{ shopSlug: string; id: string }>;
}) {
  const resolvedParams = await params;
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const therapistId = resolvedParams.id;

  const store = await fetchStoreConfig(shopSlug);

  const [therapist, blogs] = await Promise.all([
    fetchTherapistDetail(therapistId),
    DIARY_FEATURE_ENABLED ? fetchBlogArticles(store.id, therapistId) : Promise.resolve([]),
  ]);

  // 本日（営業日）の部屋割り確定済みシフトを取得。
  // 深夜営業のシフトは日付を跨ぐため、単純なカレンダー日付ではなく
  // 店舗の営業日切り替え時刻（デフォルト06:00）を考慮したJST基準の営業日で判定する。
  const cutoff = await fetchBusinessDayCutoff(store.id);
  const todayStr = getJstBusinessDateStr(cutoff);
  const confirmedShifts = await fetchConfirmedShifts(store.id, todayStr, todayStr);
  const todayShift = confirmedShifts.find((s) => s.therapistId === therapistId) || null;

  return (
    <TherapistDetailView
      shopSlug={shopSlug}
      store={store}
      therapist={therapist}
      blogs={blogs}
      todayShift={todayShift}
    />
  );
}
