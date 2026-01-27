"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import TimeChart from '../components/TimeChart';

interface Shift {
  id: string;
  therapist_id: string;
  room_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  therapists: any;
  rooms: any;
}

interface Therapist {
  id: string;
  name: string;
  avatar?: string;
  shiftStart?: string;
  shiftEnd?: string;
}

interface Schedule {
  therapistId: string;
  startTime: string;
  endTime: string;
  title: string;
  color?: string;
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [filterDate, setFilterDate] = useState(() => {
    // デフォルトで当日の日付を設定
    return new Date().toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(false);

  const handlePrevDay = () => {
    const prevDate = new Date(filterDate);
    prevDate.setDate(prevDate.getDate() - 1);
    setFilterDate(prevDate.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const nextDate = new Date(filterDate);
    nextDate.setDate(nextDate.getDate() + 1);
    setFilterDate(nextDate.toISOString().split('T')[0]);
  };

  useEffect(() => {
    fetchTherapists();
    fetchShifts();
  }, [filterDate]);

  const fetchTherapists = async () => {
    try {
      // 指定日付のシフト情報を取得
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('therapist_id, therapists(id, name, order), rooms(name), start_time, end_time')
        .eq('date', filterDate);

      if (shiftsError) {
        console.error('Error fetching shifts:', shiftsError);
        return;
      }

      // シフト情報をセラピストに紐付ける
      const therapistsWithShift = (shiftsData || []).map((shift: any) => {
        const startTime = formatTimeToHHMM(shift.start_time);
        const endTime = formatTimeToHHMM(shift.end_time);
        return {
          id: shift.therapists?.id,
          name: shift.therapists?.name,
          avatar: undefined,
          shiftStart: startTime,
          shiftEnd: endTime,
          room: shift.rooms?.name,
          order: shift.therapists?.order ?? 999,
        };
      });

      // orderでソート
      therapistsWithShift.sort((a: any, b: any) => a.order - b.order);

      setTherapists(therapistsWithShift as Therapist[]);
    } catch (error) {
      console.error('Unexpected error in fetchTherapists:', error);
    }
  };

  const formatTimeToHHMM = (timeStr: string | null): string | null => {
    if (!timeStr) return null;
    
    const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      const hours = String(parseInt(match[1])).padStart(2, '0');
      const minutes = match[2];
      return `${hours}:${minutes}`;
    }
    return null;
  };

  const fetchShifts = async () => {
    setLoading(true);
    let query = supabase
      .from('shifts')
      .select('id, therapist_id, room_id, date, start_time, end_time, therapists(name), rooms(name)')
      .order('date', { ascending: false });

    if (filterDate) {
      query = query.eq('date', filterDate);
    }

    const { data, error } = await query;
    setLoading(false);
    if (error) {
      alert('Error fetching shifts: ' + error.message);
    } else {
      setShifts((data as Shift[]) || []);
    }
  };

  // シフトデータをスケジュール形式に変換
  const schedules: Schedule[] = shifts.map((shift) => ({
    therapistId: shift.therapist_id,
    startTime: shift.start_time.slice(0, 5),
    endTime: shift.end_time.slice(0, 5),
    title: `${shift.start_time.slice(0, 5)}-${shift.end_time.slice(0, 5)}`,
    color: '#3B82F6',
  }));

  const handleWeeklyDateClick = (therapistId: string, date: string) => {
    // シフト編集ページへのリンク、または編集モーダルを表示
    console.log(`Edit shift: ${therapistId} on ${date}`);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-2">
      <div className="w-full">
        <div className="mb-2">
          <h1 className="text-3xl font-bold text-gray-900">スケジュール</h1>
          <p className="text-gray-600 mt-1">タイムチャート表示</p>
        </div>

        {/* フィルターと表示切り替え */}
        <div className="bg-white rounded-lg shadow p-2 mb-2">
          <div className="flex flex-col md:flex-row gap-2 items-start md:items-center justify-between">
            <div className="flex gap-2 items-center">
              <button
                onClick={handlePrevDay}
                className="px-3 py-2 bg-gray-300 hover:bg-gray-400 rounded text-sm font-medium"
              >
                ← 前日
              </button>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleNextDay}
                className="px-3 py-2 bg-gray-300 hover:bg-gray-400 rounded text-sm font-medium"
              >
                次日 →
              </button>
              <button
                onClick={() => setFilterDate(new Date().toISOString().split('T')[0])}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
              >
                本日
              </button>
            </div>
          </div>
        </div>

        {/* ローディング */}
        {loading && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        )}

        {/* タイムチャートビュー */}
        {!loading && (
          <div className="bg-white rounded-lg shadow-lg overflow-visible">
            <div className="h-[600px] w-full">
              {therapists.length > 0 ? (
                <TimeChart therapists={therapists} schedules={schedules} date={filterDate} />
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