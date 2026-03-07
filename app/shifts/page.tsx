"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useShop } from '@/app/contexts/ShopContext';
import TimeChart from '../components/TimeChart';

interface Shift {
  id: string;
  therapist_id: string;
  room_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  therapists: { name: string } | null;
  rooms: { name: string } | null;
}

interface Reservation {
  id: string;
  therapist_id: string;
  customer_id: string;
  date: string;
  start_time: string;
  end_time: string;
  customers: { name: string } | null;
}

interface TherapistRow {
  id: string;
  name: string;
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
  type?: 'shift' | 'reservation'; // 'shift' or 'reservation'
  reservationId?: string;
  customerId?: string;
  customerName?: string;
}

export default function ShiftsPage() {
  const { selectedShop } = useShop();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
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
    fetchReservations();
  }, [filterDate, selectedShop]);

  const fetchTherapists = async () => {
    if (!selectedShop) return;
    try {
      // すべてのセラピストを名前順で取得
      const { data: allTherapists, error: therapistsError } = await supabase
        .from('therapists')
        .select('id, name')
        .eq('shop_id', selectedShop.id)
        .order('name', { ascending: true });

      if (therapistsError) {
        console.error('Error fetching therapists:', therapistsError);
        return;
      }

      // その日のシフト情報を取得（セラピストの営業時間を確認するため）
      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('therapist_id, rooms(name), start_time, end_time')
        .eq('shop_id', selectedShop.id)
        .eq('date', filterDate);

      if (shiftsError) {
        console.error('Error fetching shifts:', shiftsError);
        return;
      }

      // シフト情報をマップで処理
      const shiftsMap = new Map<string, { therapist_id: string; start_time: string | null; end_time: string | null; rooms: { name: string } | null }>();
      (shiftsData || []).forEach((shift: any) => {
        shiftsMap.set(shift.therapist_id, shift);
      });

      // セラピストにシフト情報を追加
      const therapistsWithShift = ((allTherapists || []) as TherapistRow[]).map((therapist) => {
        const shift = shiftsMap.get(therapist.id);
        const startTime = shift ? formatTimeToHHMM(shift.start_time) : null;
        const endTime = shift ? formatTimeToHHMM(shift.end_time) : null;

        return {
          id: therapist.id,
          name: therapist.name,
          avatar: undefined,
          shiftStart: startTime,
          shiftEnd: endTime,
          room: shift?.rooms?.name,
        };
      });

      // 開始時間の早い順でソート（数値変換して比較）
      const timeToMinutes = (timeStr: string | null): number => {
        if (!timeStr) return 9999; // nullは末尾
        const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return 9999;
        return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
      };

      therapistsWithShift.sort((a, b) => {
        const aMin = timeToMinutes(a.shiftStart);
        const bMin = timeToMinutes(b.shiftStart);
        // 開始時間が同じ場合は終了時間で比較
        if (aMin === bMin) {
          const aEndMin = timeToMinutes(a.shiftEnd);
          const bEndMin = timeToMinutes(b.shiftEnd);
          return aEndMin - bEndMin;
        }
        return aMin - bMin;
      });

      console.log('=== shifts/page.tsx Therapists Order ===');
      therapistsWithShift.forEach((t, i: number) => {
        console.log(`[${i}] ${t.name} (shiftStart: ${t.shiftStart}) (id: ${t.id.substring(0, 8)}...)`);
      });

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
    if (!selectedShop) return;
    setLoading(true);
    let query = supabase
      .from('shifts')
      .select('id, therapist_id, room_id, date, start_time, end_time, therapists(name), rooms(name)')
      .eq('shop_id', selectedShop.id)
      .order('date', { ascending: false });

    if (filterDate) {
      query = query.eq('date', filterDate);
    }

    const { data, error } = await query;
    setLoading(false);
    if (error) {
      alert('Error fetching shifts: ' + error.message);
    } else {
      setShifts((data as unknown as Shift[]) || []);
    }
  };

  const fetchReservations = async () => {
    if (!selectedShop) return;
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          therapist_id,
          customer_id,
          date,
          start_time,
          end_time,
          customers(name)
        `)
        .eq('shop_id', selectedShop.id)
        .eq('date', filterDate)
        .eq('status', 'confirmed');

      if (error) throw error;
      setReservations((data as unknown as Reservation[]) || []);
    } catch (error) {
      console.error('予約の取得に失敗:', error);
    }
  };

  // シフトデータをスケジュール形式に変換
  const schedules: Schedule[] = [
    // 予約のみを表示（シフトは非表示）
    ...reservations.map((reservation) => ({
      therapistId: reservation.therapist_id,
      startTime: reservation.start_time.slice(0, 5),
      endTime: reservation.end_time.slice(0, 5),
      title: `${reservation.customers?.name || 'unknown'}`,
      type: 'reservation' as const,
      reservationId: reservation.id,
      customerId: reservation.customer_id,
      customerName: reservation.customers?.name,
    })),
  ];

  const handleWeeklyDateClick = (therapistId: string, date: string) => {
    // シフト編集ページへのリンク、または編集モーダルを表示
    console.log(`Edit shift: ${therapistId} on ${date}`);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="w-full max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">スケジュール</h1>
          <p className="text-sm text-slate-500 mt-1">タイムチャート表示</p>
        </div>

        {/* フィルターと表示切り替え */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
            <div className="flex gap-2 items-center bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <button
                onClick={handlePrevDay}
                className="px-3 py-2 bg-white text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm font-bold shadow-sm border border-slate-200 transition-colors"
              >
                ← 前日
              </button>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm"
              />
              <button
                onClick={handleNextDay}
                className="px-3 py-2 bg-white text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm font-bold shadow-sm border border-slate-200 transition-colors"
              >
                翌日 →
              </button>
              <div className="w-px h-6 bg-slate-200 mx-1"></div>
              <button
                onClick={() => setFilterDate(new Date().toISOString().split('T')[0])}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors font-bold"
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
              {(() => {
                // filterDate にシフトがあるセラピストのみ表示
                const therapistsWithShift = therapists.filter(t => t.shiftStart && t.shiftEnd);
                return therapistsWithShift.length > 0 ? (
                  <TimeChart therapists={therapistsWithShift} schedules={schedules} date={filterDate} />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    <p>シフトがあるセラピストがいません</p>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


