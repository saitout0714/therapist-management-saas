'use client';

import React, { useState, useEffect, use } from 'react';
import { Header } from '../../../../components/store/Header';
import { PageHeading } from '../../../../components/store/SectionHeading';
import { Footer } from '../../../../components/store/Footer';
import { WeeklySchedule } from '../../../../components/store/WeeklySchedule';
import { ThemeProvider } from '../../../../components/store/ThemeProvider';
import { fetchStoreConfig, fetchTherapists, fetchConfirmedShifts } from '../../../../lib/storeApi';
import { StoreConfig, Therapist, ConfirmedShift } from '../../../../types/store';
import { BLANK_STORE } from '../../../../mock/specialgrade';
import { BLANK_ONYANKO_STORE } from '../../../../mock/onyankospa';

import { CyberParallaxBackground } from '../../../../components/store/CyberParallaxBackground';

export default function SchedulePage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const isOnyanko = shopSlug === 'onyankospa';
  const [store, setStore] = useState<StoreConfig>(isOnyanko ? BLANK_ONYANKO_STORE : BLANK_STORE);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [confirmedShifts, setConfirmedShifts] = useState<ConfirmedShift[]>([]);

  useEffect(() => {
    async function loadData() {
      const storeConfig = await fetchStoreConfig(shopSlug);
      setStore(storeConfig);

      const today = new Date();
      const endDay = new Date();
      endDay.setDate(today.getDate() + 7);

      const startDateStr = today.toISOString().split('T')[0];
      const endDateStr = endDay.toISOString().split('T')[0];

      const [list, shifts] = await Promise.all([
        fetchTherapists(storeConfig.id),
        fetchConfirmedShifts(storeConfig.id, startDateStr, endDateStr),
      ]);

      setTherapists(list);
      setConfirmedShifts(shifts);
    }
    loadData();
  }, [shopSlug]);

  const isCyberTheme = shopSlug === 'onyankospa';

  return (
    <ThemeProvider store={store}>
      <div className={`min-h-screen flex flex-col relative ${
        isCyberTheme ? 'cyber-bg text-[#f4eefa]' : 'bg-[#faf9f5] text-stone-800 font-serif'
      }`}>
        {isCyberTheme && <CyberParallaxBackground variant="medium" pageType="schedule" />}
        <Header store={store} />

        <main className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full relative z-10">
          <PageHeading
            title="Schedule"
            subtitle="週間出勤スケジュール (リアルタイム反映)"
            isCyber={isCyberTheme}
            className="mb-8"
          />

          <WeeklySchedule
            therapists={therapists}
            confirmedShifts={confirmedShifts}
            storeSlug={shopSlug}
          />
        </main>

        <Footer store={store} />
      </div>
    </ThemeProvider>
  );
}

