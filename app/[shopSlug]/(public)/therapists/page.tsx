'use client';

import React, { useState, use } from 'react';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { TherapistCard } from '../../../../components/store/TherapistCard';
import { TherapistFilter } from '../../../../components/store/TherapistFilter';
import { MOCK_STORE, MOCK_THERAPISTS } from '../../../../mock/specialgrade';

export default function TherapistsPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const allTags = Array.from(new Set(MOCK_THERAPISTS.flatMap((t) => t.tags)));

  const filteredTherapists = selectedTag
    ? MOCK_THERAPISTS.filter((t) => t.tags.includes(selectedTag))
    : MOCK_THERAPISTS;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header store={MOCK_STORE} />

      <main className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-300">
            セラピスト一覧
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            在籍する魅力溢れるセラピストたち
          </p>

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

      <Footer store={MOCK_STORE} />
    </div>
  );
}
