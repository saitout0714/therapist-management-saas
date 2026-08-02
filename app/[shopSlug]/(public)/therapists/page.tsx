'use client';

import React, { useState, useEffect, use } from 'react';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { TherapistCard } from '../../../../components/store/TherapistCard';
import { TherapistFilter } from '../../../../components/store/TherapistFilter';
import { fetchStoreConfig, fetchTherapists } from '../../../../lib/storeApi';
import { StoreConfig, Therapist } from '../../../../types/store';
import { MOCK_STORE, MOCK_THERAPISTS } from '../../../../mock/specialgrade';

export default function TherapistsPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const [store, setStore] = useState<StoreConfig>(MOCK_STORE);
  const [therapists, setTherapists] = useState<Therapist[]>(MOCK_THERAPISTS);
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

  return (
    <div className="min-h-screen bg-[#faf9f5] text-stone-800 flex flex-col font-serif">
      <Header store={store} />

      <main className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-stone-800 tracking-widest">Therapists</h1>
          <span className="inline-block text-xs text-[#a39573] border-t border-stone-800 px-4 pt-1 mt-1 tracking-widest">
            セラピスト一覧
          </span>

          <TherapistFilter
            tags={allTags}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredTherapists.map((therapist) => (
            <TherapistCard
              key={therapist.id}
              therapist={therapist}
              storeSlug={shopSlug}
            />
          ))}
        </div>
      </main>

      <Footer store={store} />
    </div>
  );
}

