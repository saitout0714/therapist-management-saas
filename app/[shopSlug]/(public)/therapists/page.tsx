'use client';

import React, { useState, useEffect, use } from 'react';
import { Header } from '../../../../components/store/Header';
import { PageHeading } from '../../../../components/store/SectionHeading';
import { Footer } from '../../../../components/store/Footer';
import { TherapistCard } from '../../../../components/store/TherapistCard';
import { TherapistFilter } from '../../../../components/store/TherapistFilter';
import { ThemeProvider } from '../../../../components/store/ThemeProvider';
import { fetchStoreConfig, fetchTherapists, fetchConfirmedShifts } from '../../../../lib/storeApi';
import { StoreConfig, Therapist, ConfirmedShift } from '../../../../types/store';
import { BLANK_STORE } from '../../../../mock/specialgrade';
import { BLANK_ONYANKO_STORE } from '../../../../mock/onyankospa';

import { CyberParallaxBackground } from '../../../../components/store/CyberParallaxBackground';

export default function TherapistsPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const isOnyanko = shopSlug === 'onyankospa';
  const [store, setStore] = useState<StoreConfig>(isOnyanko ? BLANK_ONYANKO_STORE : BLANK_STORE);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [todayShifts, setTodayShifts] = useState<ConfirmedShift[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const storeConfig = await fetchStoreConfig(shopSlug);
      setStore(storeConfig);
      const todayStr = new Date().toISOString().split('T')[0];
      const [list, shifts] = await Promise.all([
        fetchTherapists(storeConfig.id),
        fetchConfirmedShifts(storeConfig.id, todayStr, todayStr),
      ]);
      setTherapists(list);
      setTodayShifts(shifts);
    }
    loadData();
  }, [shopSlug]);

  const todayShiftMap = new Map(todayShifts.map((s) => [s.therapistId, s]));

  const allTags = Array.from(new Set(therapists.flatMap((t) => t.tags)));

  const filteredTherapists = selectedTag
    ? therapists.filter((t) => t.tags.includes(selectedTag))
    : therapists;

  const isCyberTheme = shopSlug === 'onyankospa';

  return (
    <ThemeProvider store={store}>
      <div className={`min-h-screen flex flex-col relative ${
        isCyberTheme ? 'cyber-bg text-[#f4eefa]' : 'bg-[#faf9f5] text-stone-800 font-serif'
      }`}>
        {isCyberTheme && <CyberParallaxBackground variant="medium" pageType="therapists" />}
        <Header store={store} />

        <main className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full relative z-10">
        <div className="text-center mb-8">
          <PageHeading title="Therapist" subtitle="セラピスト一覧" isCyber={isCyberTheme} />

          <TherapistFilter
            tags={allTags}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            isCyber={isCyberTheme}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {filteredTherapists.map((therapist, idx) => {
            const todayShift = todayShiftMap.get(therapist.id);
            return (
              <TherapistCard
                key={therapist.id}
                therapist={therapist}
                storeSlug={shopSlug}
                confirmedShiftTime={todayShift ? `${todayShift.startTime}~${todayShift.endTime}` : undefined}
                showTodayBadge={!!todayShift}
                primaryColor={store.themeColor?.primary}
                index={idx}
              />
            );
          })}
        </div>
      </main>

      <Footer store={store} />
    </div>
    </ThemeProvider>
  );
}

