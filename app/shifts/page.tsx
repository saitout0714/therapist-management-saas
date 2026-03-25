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
  status: string;
  total_price: number;
  designation_type: string;
  customers: { name: string; created_at: string } | null;
  courses: { name: string; duration: number } | null;
}

interface TherapistRow {
  id: string;
  name: string;
  reservation_interval_minutes: number | null;
}

interface Therapist {
  id: string;
  name: string;
  avatar?: string;
  shiftStart?: string;
  shiftEnd?: string;
  intervalMinutes?: number | null;
}

interface Schedule {
  therapistId: string;
  startTime: string; // "HH:mm" format
  endTime: string;
  title: string;
  color?: string;
  type?: 'shift' | 'reservation' | 'interval' | 'blocked';
  reservationId?: string;
  customerId?: string;
  customerName?: string;
  courseDuration?: number;
  designationLabel?: string;
  totalPrice?: number;
  isNewCustomer?: boolean;
}

export default function ShiftsPage() {
  const { selectedShop } = useShop();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [shopIntervalMinutes, setShopIntervalMinutes] = useState<number>(20);
  const [filterDate, setFilterDate] = useState(() => {
    // デフォルトで当日の日付を設定
    return new Date().toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // 予約不可編集モーダル
  const [blockedModal, setBlockedModal] = useState<{
    id: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  const handleBlockedDelete = async (id: string) => {
    if (!confirm('この予約不可ブロックを削除しますか？')) return;
    const { error } = await supabase.from('reservations').delete().eq('id', id);
    if (error) { alert('削除に失敗しました'); return; }
    setBlockedModal(null);
    setRefreshCounter(c => c + 1);
  };

  const handleBlockedSave = async () => {
    if (!blockedModal) return;
    const { error } = await supabase.from('reservations').update({
      start_time: blockedModal.startTime,
      end_time: blockedModal.endTime,
    }).eq('id', blockedModal.id);
    if (error) { alert('更新に失敗しました'); return; }
    setBlockedModal(null);
    setRefreshCounter(c => c + 1);
  };

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
  }, [filterDate, selectedShop, refreshCounter]);

  const fetchTherapists = async () => {
    if (!selectedShop) return;
    try {
      // セラピスト一覧（インターバル込み、列が未追加の場合はフォールバック）
      let allTherapists: TherapistRow[] = [];
      const { data: therapistsWithInterval, error: therapistsError } = await supabase
        .from('therapists')
        .select('id, name, reservation_interval_minutes')
        .eq('shop_id', selectedShop.id)
        .order('name', { ascending: true });

      if (therapistsError) {
        // reservation_interval_minutes 列が未追加の場合はフォールバック
        const { data: basicData } = await supabase
          .from('therapists')
          .select('id, name')
          .eq('shop_id', selectedShop.id)
          .order('name', { ascending: true });
        allTherapists = (basicData || []).map(t => ({ ...t, reservation_interval_minutes: null }));
      } else {
        allTherapists = therapistsWithInterval || [];
      }

      // 店舗デフォルトインターバルを取得
      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('reservation_interval_minutes')
        .eq('shop_id', selectedShop.id)
        .limit(1);
      const shopInterval = settingsData?.[0]?.reservation_interval_minutes ?? 20;
      setShopIntervalMinutes(shopInterval);

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
          intervalMinutes: therapist.reservation_interval_minutes ?? shopInterval,
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
          status,
          total_price,
          designation_type,
          customers(name, created_at),
          courses(name, duration)
        `)
        .eq('shop_id', selectedShop.id)
        .eq('date', filterDate)
        .in('status', ['confirmed', 'blocked']);

      if (error) throw error;
      setReservations((data as unknown as Reservation[]) || []);
    } catch (error) {
      console.error('予約の取得に失敗:', error);
    }
  };

  // 分をHH:MM文字列に変換
  const minutesToHHMM = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const hhmToMinutes = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };

  const designationLabel = (v: string) => ({ free: 'フリー', nomination: '指名', confirmed: '本指名', princess: '姫予約' }[v] || v);

  // 予約のみを表示 + 予約後インターバルブロックを追加
  const schedules: Schedule[] = [
    ...reservations
      .filter((r: any) => r.status !== 'blocked')
      .map((reservation) => ({
        therapistId: reservation.therapist_id,
        startTime: reservation.start_time.slice(0, 5),
        endTime: reservation.end_time.slice(0, 5),
        title: `${reservation.customers?.name || 'unknown'}`,
        type: 'reservation' as const,
        reservationId: reservation.id,
        customerId: reservation.customer_id,
        customerName: reservation.customers?.name,
        courseDuration: reservation.courses?.duration,
        designationLabel: designationLabel(reservation.designation_type),
        totalPrice: reservation.total_price,
        isNewCustomer: reservation.customers?.created_at?.split('T')[0] === reservation.date,
      })),
    // 予約不可ブロック
    ...reservations
      .filter((r: any) => r.status === 'blocked')
      .map((reservation) => ({
        therapistId: reservation.therapist_id,
        startTime: reservation.start_time.slice(0, 5),
        endTime: reservation.end_time.slice(0, 5),
        title: '予約不可',
        type: 'blocked' as const,
        reservationId: reservation.id,
      })),
    // インターバルブロック（予約終了直後〜インターバル終了まで）
    ...reservations
      .filter((r: any) => r.status !== 'blocked')
      .flatMap((reservation) => {
      const therapist = therapists.find(t => t.id === reservation.therapist_id);
      const interval = therapist?.intervalMinutes != null
        ? therapist.intervalMinutes
        : shopIntervalMinutes;
      if (interval <= 0) return [];
      const endMin = hhmToMinutes(reservation.end_time.slice(0, 5));
      const intervalEndMin = endMin + interval;
      return [{
        therapistId: reservation.therapist_id,
        startTime: reservation.end_time.slice(0, 5),
        endTime: minutesToHHMM(intervalEndMin),
        title: `インターバル ${interval}分`,
        type: 'interval' as const,
      }];
    }),
  ];

  const handleWeeklyDateClick = (therapistId: string, date: string) => {
    // シフト編集ページへのリンク、または編集モーダルを表示
    console.log(`Edit shift: ${therapistId} on ${date}`);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="w-full mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">スケジュール</h1>
          <p className="text-sm text-slate-500 mt-1">タイムチャート表示</p>
        </div>

        {/* フィルターと表示切り替え */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6">
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
                   <TimeChart
                    therapists={therapistsWithShift}
                    schedules={schedules}
                    date={filterDate}
                    onBlockedClick={(id, startTime, endTime) =>
                      setBlockedModal({ id, startTime, endTime })
                    }
                  />
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

      {/* 予約不可編集モーダル */}
      {blockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setBlockedModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-6">予約不可ブロックの編集</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">開始時刻</label>
                <input
                  type="time"
                  value={blockedModal.startTime}
                  onChange={e => setBlockedModal({ ...blockedModal, startTime: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">終了時刻</label>
                <input
                  type="time"
                  value={blockedModal.endTime}
                  onChange={e => setBlockedModal({ ...blockedModal, endTime: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleBlockedSave}
                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
              >
                保存する
              </button>
              <button
                onClick={() => handleBlockedDelete(blockedModal.id)}
                className="flex-1 py-3 bg-rose-500 text-white font-bold rounded-xl hover:bg-rose-600 transition-colors"
              >
                削除する
              </button>
              <button
                onClick={() => setBlockedModal(null)}
                className="px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


