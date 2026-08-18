import React from 'react';
import { headers } from 'next/headers';
import { Header } from '../../../../components/store/Header';
import { PageHeading } from '../../../../components/store/SectionHeading';
import { Footer } from '../../../../components/store/Footer';
import { WeeklySchedule } from '../../../../components/store/WeeklySchedule';
import { ThemeProvider } from '../../../../components/store/ThemeProvider';
import { fetchStoreConfig, fetchTherapists, fetchConfirmedShifts, fetchBusinessDayCutoff, getJstBusinessDateStr } from '../../../../lib/storeApi';
import { publicBasePath } from '../../../../lib/shopDomains';

import { CyberParallaxBackground } from '../../../../components/store/CyberParallaxBackground';

/** サーバーコンポーネント。出勤スケジュールをHTMLに載せるため取得をサーバー側に移している。 */
export default async function SchedulePage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = await params;
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';

  const host = (await headers()).get('host');
  const basePath = publicBasePath(host, shopSlug);
  const store = { ...(await fetchStoreConfig(shopSlug)), basePath };

  // 深夜営業のシフトが日付を跨いでも「本日」が正しく判定されるよう、
  // 店舗の営業日切り替え時刻を考慮したJST基準の営業日を起点にする。
  const cutoff = await fetchBusinessDayCutoff(store.id);
  const businessTodayStr = getJstBusinessDateStr(cutoff);

  const endDay = new Date(`${businessTodayStr}T00:00:00`);
  endDay.setDate(endDay.getDate() + 7);
  const y = endDay.getFullYear();
  const m = String(endDay.getMonth() + 1).padStart(2, '0');
  const d = String(endDay.getDate()).padStart(2, '0');
  const endDateStr = `${y}-${m}-${d}`;

  const [therapists, confirmedShifts] = await Promise.all([
    fetchTherapists(store.id),
    fetchConfirmedShifts(store.id, businessTodayStr, endDateStr),
  ]);

  const isCyberTheme = shopSlug === 'onyankospa';
  const isLuxuryTheme = shopSlug === 'specialgrade';

  return (
    <ThemeProvider store={store}>
      <div className={`min-h-screen flex flex-col relative ${
        isCyberTheme ? 'cyber-bg text-[#f4eefa]' : isLuxuryTheme ? 'luxury-marble-bg luxury-body' : 'bg-[#faf9f5] text-stone-800 font-serif'
      }`}>
        {isCyberTheme && <CyberParallaxBackground variant="medium" pageType="schedule" />}
        <Header store={store} />

        <main className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full relative z-10">
          <PageHeading
            title="Schedule"
            subtitle="週間出勤スケジュール (リアルタイム反映)"
            isCyber={isCyberTheme}
            isLuxury={isLuxuryTheme}
            className="mb-8"
          />

          <WeeklySchedule
            therapists={therapists}
            confirmedShifts={confirmedShifts}
            storeSlug={shopSlug}
            basePath={basePath}
            businessTodayStr={businessTodayStr ?? undefined}
          />
        </main>

        <Footer store={store} />
      </div>
    </ThemeProvider>
  );
}

