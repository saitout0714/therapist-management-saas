'use client';

import React, { useState, useEffect, use } from 'react';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { TherapistCard } from '../../../../components/store/TherapistCard';
import { TherapistFilter } from '../../../../components/store/TherapistFilter';
import { ThemeProvider } from '../../../../components/store/ThemeProvider';
import { fetchStoreConfig, fetchTherapists } from '../../../../lib/storeApi';
import { StoreConfig, Therapist } from '../../../../types/store';
import { MOCK_STORE } from '../../../../mock/specialgrade';
import { MOCK_ONYANKO_STORE } from '../../../../mock/onyankospa';

export default function TherapistsPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const isOnyanko = shopSlug === 'onyankospa';
  const [store, setStore] = useState<StoreConfig>(isOnyanko ? MOCK_ONYANKO_STORE : MOCK_STORE);
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
      <div className={`min-h-screen flex flex-col ${
        isCyberTheme ? 'cyber-bg text-stone-100 font-sans' : 'bg-[#faf9f5] text-stone-800 font-serif'
      }`}>
      <Header store={store} />

      <main className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-8">
          <h1 className={`text-2xl font-bold tracking-widest ${isCyberTheme ? 'neon-text-pink' : 'text-stone-800'}`}>Therapists</h1>
          <span className={`inline-block text-xs border-t px-4 pt-1 mt-1 tracking-widest ${
            isCyberTheme ? 'text-[#ff2a8d] border-[#ff007f]' : 'text-[#a39573] border-stone-800'
          }`}>
            セラピスト一覧
          </span>

          <TherapistFilter
            tags={allTags}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            isCyber={isCyberTheme}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {filteredTherapists.map((therapist) => (
            <TherapistCard
              key={therapist.id}
              therapist={therapist}
              storeSlug={shopSlug}
              primaryColor={store.themeColor?.primary}
            />
          ))}
        </div>
      </main>

      <Footer store={store} />
    </div>
    </ThemeProvider>
  );
}

