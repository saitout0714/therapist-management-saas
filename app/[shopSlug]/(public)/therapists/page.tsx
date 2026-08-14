'use client';

import React, { useState, useEffect, use } from 'react';
import { Header } from '../../../../components/store/Header';
import { PageHeading } from '../../../../components/store/SectionHeading';
import { Footer } from '../../../../components/store/Footer';
import { TherapistCard } from '../../../../components/store/TherapistCard';
import { TherapistFilter } from '../../../../components/store/TherapistFilter';
import { ThemeProvider } from '../../../../components/store/ThemeProvider';
import { fetchStoreConfig, fetchTherapists } from '../../../../lib/storeApi';
import { StoreConfig, Therapist } from '../../../../types/store';
import { BLANK_STORE } from '../../../../mock/specialgrade';
import { BLANK_ONYANKO_STORE } from '../../../../mock/onyankospa';

import { CyberParallaxBackground } from '../../../../components/store/CyberParallaxBackground';

export default function TherapistsPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const isOnyanko = shopSlug === 'onyankospa';
  const [store, setStore] = useState<StoreConfig>(isOnyanko ? BLANK_ONYANKO_STORE : BLANK_STORE);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const storeConfig = await fetchStoreConfig(shopSlug);
      setStore(storeConfig);
      const list = await fetchTherapists(storeConfig.id);
      setTherapists(list);
    }
    loadData();
  }, [shopSlug]);

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
          {filteredTherapists.map((therapist, idx) => (
            <TherapistCard
              key={therapist.id}
              therapist={therapist}
              storeSlug={shopSlug}
              primaryColor={store.themeColor?.primary}
              index={idx}
            />
          ))}
        </div>
      </main>

      <Footer store={store} />
    </div>
    </ThemeProvider>
  );
}

