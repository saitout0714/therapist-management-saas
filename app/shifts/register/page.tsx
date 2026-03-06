"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useShop } from '@/app/contexts/ShopContext';
import WeeklyShiftCalendar from '../../components/WeeklyShiftCalendar';

interface Shift {
  id: string;
  therapist_id: string;
  room_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
}

interface Therapist {
  id: string;
  name: string;
  avatar?: string;
}

export default function RegisterShift() {
  const { selectedShop } = useShop();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTherapists();
    fetchShifts();
  }, [selectedShop]);

  const fetchTherapists = async () => {
    if (!selectedShop) return;
    try {
      const { data: therapistsData, error: therapistsError } = await supabase
        .from('therapists')
        .select('id, name, order')
        .eq('shop_id', selectedShop.id)
        .order('order', { ascending: true, nullsFirst: false });

      if (therapistsError) {
        console.error('Error fetching therapists:', therapistsError);
        return;
      }

      const therapistsWithShift = (therapistsData || []).map((therapist) => {
        return {
          id: therapist.id,
          name: therapist.name,
          avatar: undefined,
        };
      });

      setTherapists(therapistsWithShift as Therapist[]);
    } catch (error) {
      console.error('Unexpected error in fetchTherapists:', error);
    }
  };

  const fetchShifts = async () => {
    if (!selectedShop) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('shifts')
      .select('id, therapist_id, room_id, date, start_time, end_time')
      .eq('shop_id', selectedShop.id)
      .order('date', { ascending: false });

    setLoading(false);
    if (error) {
      alert('Error fetching shifts: ' + error.message);
    } else {
      setShifts((data as Shift[]) || []);
    }
  };

  const handleShiftUpdate = () => {
    fetchShifts();
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      <div className="w-full max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">シフト登録</h1>
          <p className="text-sm text-slate-500 mt-1">店舗に所属するセラピストのシフト（出勤枠）を週単位で登録・編集します。</p>
        </div>

        {/* ローディング */}
        {loading && (
          <div className="flex justify-center items-center py-20 text-indigo-600">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 font-medium">読み込み中...</span>
          </div>
        )}

        {/* 週単位シフトカレンダー */}
        {!loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="h-[700px]">
              {therapists.length > 0 ? (
                <WeeklyShiftCalendar
                  therapists={therapists}
                  shifts={shifts}
                  onShiftUpdate={handleShiftUpdate}
                  showOnlyWithShift={false}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 flex-col gap-3">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex justify-center items-center text-slate-400">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </div>
                  <p>セラピストデータを読み込み中...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}