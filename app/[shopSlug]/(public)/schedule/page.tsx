'use client';

import React, { use } from 'react';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { WeeklySchedule } from '../../../../components/store/WeeklySchedule';
import { MOCK_STORE, MOCK_THERAPISTS } from '../../../../mock/specialgrade';

export default function SchedulePage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header store={MOCK_STORE} />

      <main className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-300">
            週間出勤スケジュール
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            セラピストの出勤予定日および時間帯をご確認いただけます
          </p>
        </div>

        <WeeklySchedule therapists={MOCK_THERAPISTS} storeSlug={shopSlug} />
      </main>

      <Footer store={MOCK_STORE} />
    </div>
  );
}
