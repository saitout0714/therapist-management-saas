"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
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
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTherapists();
    fetchShifts();
  }, []);

  const fetchTherapists = async () => {
    try {
      const { data: therapistsData, error: therapistsError } = await supabase
        .from('therapists')
        .select('id, name, order')
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
    setLoading(true);
    const { data, error } = await supabase
      .from('shifts')
      .select('id, therapist_id, room_id, date, start_time, end_time')
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
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">シフト登録</h1>
          <p className="text-gray-600 mt-2">週単位でシフトを登録・編集できます</p>
        </div>

        {/* ローディング */}
        {loading && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        )}

        {/* 週単位シフトカレンダー */}
        {!loading && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="h-[600px]">
              {therapists.length > 0 ? (
                <WeeklyShiftCalendar 
                  therapists={therapists} 
                  shifts={shifts}
                  onShiftUpdate={handleShiftUpdate}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
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