import React from 'react';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { TherapistFilterableGrid } from '../../../../components/store/TherapistFilterableGrid';
import { ThemeProvider } from '../../../../components/store/ThemeProvider';
import { fetchStoreConfig, fetchTherapists, fetchConfirmedShifts, fetchBusinessDayCutoff, getJstBusinessDateStr } from '../../../../lib/storeApi';

import { CyberParallaxBackground } from '../../../../components/store/CyberParallaxBackground';

/**
 * サーバーコンポーネント。セラピスト一覧をHTMLに載せるため、
 * 取得をサーバー側に移している（タグ絞り込みのみクライアント側）。
 */
export default async function TherapistsPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = await params;
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';

  const store = await fetchStoreConfig(shopSlug);

  // 深夜営業のシフトが日付を跨いでも「本日出勤」が正しく判定されるよう、
  // 店舗の営業日切り替え時刻を考慮したJST基準の営業日を使う。
  const cutoff = await fetchBusinessDayCutoff(store.id);
  const todayStr = getJstBusinessDateStr(cutoff);

  const [therapists, todayShifts] = await Promise.all([
    fetchTherapists(store.id),
    fetchConfirmedShifts(store.id, todayStr, todayStr),
  ]);

  const isCyberTheme = shopSlug === 'onyankospa';

  return (
    <ThemeProvider store={store}>
      <div className={`min-h-screen flex flex-col relative ${
        isCyberTheme ? 'cyber-bg text-[#f4eefa]' : 'bg-[#faf9f5] text-stone-800 font-serif'
      }`}>
        {isCyberTheme && <CyberParallaxBackground variant="medium" pageType="therapists" />}
        <Header store={store} />

        <main className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full relative z-10">
          <TherapistFilterableGrid
            therapists={therapists}
            todayShifts={todayShifts}
            shopSlug={shopSlug}
            isCyber={isCyberTheme}
            primaryColor={store.themeColor?.primary}
          />
        </main>

      <Footer store={store} />
    </div>
    </ThemeProvider>
  );
}
