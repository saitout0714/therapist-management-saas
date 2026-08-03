'use client';

import React, { useState, useEffect, use } from 'react';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { WeeklySchedule } from '../../../../components/store/WeeklySchedule';
import { ThemeProvider } from '../../../../components/store/ThemeProvider';
import { fetchStoreConfig, fetchTherapists, fetchConfirmedShifts } from '../../../../lib/storeApi';
import { StoreConfig, Therapist, ConfirmedShift } from '../../../../types/store';
import { MOCK_STORE, MOCK_THERAPISTS } from '../../../../mock/specialgrade';

export default function SchedulePage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const [store, setStore] = useState<StoreConfig>(MOCK_STORE);
  const [therapists, setTherapists] = useState<Therapist[]>(MOCK_THERAPISTS);
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

  return (
    <ThemeProvider store={store}>
      <div className="min-h-screen bg-[#faf9f5] text-stone-800 flex flex-col font-serif">
        <Header store={store} />

        <main className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-stone-800 tracking-widest">Schedule</h1>
            <span className="inline-block text-xs text-[#a39573] border-t border-stone-800 px-4 pt-1 mt-1 tracking-widest">
              週間出勤スケジュール (部屋割り確定リアルタイム反映)
            </span>
          </div>

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

