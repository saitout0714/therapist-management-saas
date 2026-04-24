"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useShop } from '@/app/contexts/ShopContext';
import TimeChart from '../components/TimeChart';
import WeeklyDayView from '../components/WeeklyDayView';

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
  is_hime: boolean | null;
  customers: { name: string; created_at: string } | null;
  courses: { name: string; duration: number } | null;
}

interface TherapistRow {
  id: string;
  name: string;
  reservation_interval_minutes: number | null;
}

type SortMode = 'shift' | 'room' | 'reservation'

interface Therapist {
  id: string;
  name: string;
  avatar?: string;
  shiftStart?: string;
  shiftEnd?: string;
  roomId?: string | null;
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
  isHime?: boolean;
}

type ViewMode = 'day' | 'week';

const getBusinessDate = () => {
  const now = new Date()
  if (now.getHours() < 6) now.setDate(now.getDate() - 1)
  return now
}

export default function ShiftsPage() {
  const { selectedShop } = useShop();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [shopIntervalMinutes, setShopIntervalMinutes] = useState<number>(20);
  const [filterDate, setFilterDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => getBusinessDate());
  const [loading, setLoading] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>('shift');
  const [roomOrderMap, setRoomOrderMap] = useState<Map<string, number>>(new Map());

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

  useEffect(() => {
    if (!selectedShop) return;
    supabase
      .from('rooms')
      .select('id, order')
      .eq('shop_id', selectedShop.id)
      .order('order', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        const map = new Map<string, number>();
        (data || []).forEach((r: any, i: number) => map.set(r.id, r.order ?? i));
        setRoomOrderMap(map);
      });
  }, [selectedShop, refreshCounter]);

  const fetchTherapists = async () => {
    if (!selectedShop) return;
    try {
      let allTherapists: TherapistRow[] = [];
      const { data: therapistsWithInterval, error: therapistsError } = await supabase
        .from('therapists')
        .select('id, name, reservation_interval_minutes')
        .eq('shop_id', selectedShop.id)
        .order('name', { ascending: true });

      if (therapistsError) {
        const { data: basicData } = await supabase
          .from('therapists')
          .select('id, name')
          .eq('shop_id', selectedShop.id)
          .order('name', { ascending: true });
        allTherapists = (basicData || []).map(t => ({ ...t, reservation_interval_minutes: null }));
      } else {
        allTherapists = therapistsWithInterval || [];
      }

      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('reservation_interval_minutes')
        .eq('shop_id', selectedShop.id)
        .limit(1);
      const shopInterval = settingsData?.[0]?.reservation_interval_minutes ?? 20;
      setShopIntervalMinutes(shopInterval);

      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select('therapist_id, room_id, rooms(name), start_time, end_time')
        .eq('shop_id', selectedShop.id)
        .eq('date', filterDate);

      if (shiftsError) {
        console.error('Error fetching shifts:', shiftsError);
        return;
      }

      const shiftsMap = new Map<string, { therapist_id: string; room_id: string | null; start_time: string | null; end_time: string | null; rooms: { name: string } | null }>();
      (shiftsData || []).forEach((shift: any) => {
        shiftsMap.set(shift.therapist_id, shift);
      });

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
          roomId: shift?.room_id ?? null,
          room: shift?.rooms?.name,
          intervalMinutes: therapist.reservation_interval_minutes ?? shopInterval,
        };
      });

      const timeToMinutes = (timeStr: string | null): number => {
        if (!timeStr) return 9999;
        const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return 9999;
        return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
      };

      therapistsWithShift.sort((a, b) => {
        const aMin = timeToMinutes(a.shiftStart);
        const bMin = timeToMinutes(b.shiftStart);
        if (aMin === bMin) {
          const aEndMin = timeToMinutes(a.shiftEnd);
          const bEndMin = timeToMinutes(b.shiftEnd);
          return aEndMin - bEndMin;
        }
        return aMin - bMin;
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
          is_hime,
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

  const minutesToHHMM = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const hhmToMinutes = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };

  const designationLabel = (v: string) => ({ free: 'フリー', first_nomination: '初回指名', nomination: '指名', confirmed: '本指名', princess: '姫予約' }[v] || v);

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
        isHime: (reservation.is_hime ?? false) || reservation.designation_type === 'princess',
      })),
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

  const sortedTherapistsWithShift = useMemo(() => {
    const withShift = therapists.filter(t => t.shiftStart && t.shiftEnd);
    if (sortMode === 'shift') return withShift;
    if (sortMode === 'room') {
      return [...withShift].sort((a, b) => {
        const aOrder = a.roomId ? (roomOrderMap.get(a.roomId) ?? 9999) : 9999;
        const bOrder = b.roomId ? (roomOrderMap.get(b.roomId) ?? 9999) : 9999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return hhmToMinutes(a.shiftStart || '99:99') - hhmToMinutes(b.shiftStart || '99:99');
      });
    }
    if (sortMode === 'reservation') {
      const now = new Date();
      let currentMins = now.getHours() * 60 + now.getMinutes();
      if (now.getHours() < 6) currentMins += 24 * 60;

      const getShiftEndMins = (t: Therapist): number => {
        let endMins = hhmToMinutes(t.shiftEnd!);
        const startMins = hhmToMinutes(t.shiftStart || '00:00');
        if (endMins <= startMins) endMins += 24 * 60;
        return endMins;
      };

      // 退勤済み or 最後の予約+インターバル後にシフト終了時刻を超えている（実質受付不可）
      const isEffectivelyFinished = (t: Therapist): boolean => {
        if (!t.shiftEnd) return false;
        const shiftEndMins = getShiftEndMins(t);
        if (currentMins >= shiftEndMins) return true;
        const interval = t.intervalMinutes ?? shopIntervalMinutes;
        const therapistReservations = reservations.filter(
          (r: any) => r.therapist_id === t.id && r.status === 'confirmed'
        );
        if (therapistReservations.length === 0) return false;
        const maxEndMins = Math.max(
          ...therapistReservations.map((r: any) => hhmToMinutes(r.end_time.slice(0, 5)))
        );
        return (maxEndMins + interval) >= shiftEndMins;
      };

      const earliestMap = new Map<string, number>();
      reservations.filter((r: any) => r.status === 'confirmed').forEach(r => {
        const mins = hhmToMinutes(r.start_time.slice(0, 5));
        const cur = earliestMap.get(r.therapist_id) ?? 9999;
        if (mins < cur) earliestMap.set(r.therapist_id, mins);
      });
      return [...withShift].sort((a, b) => {
        const aFinished = isEffectivelyFinished(a);
        const bFinished = isEffectivelyFinished(b);
        if (aFinished !== bFinished) return aFinished ? 1 : -1;
        const aMin = earliestMap.get(a.id) ?? 9999;
        const bMin = earliestMap.get(b.id) ?? 9999;
        if (aMin !== bMin) return aMin - bMin;
        return hhmToMinutes(a.shiftStart || '99:99') - hhmToMinutes(b.shiftStart || '99:99');
      });
    }
    return withShift;
  }, [therapists, sortMode, roomOrderMap, reservations, shopIntervalMinutes]);

  // 週間表示用：全セラピストをシンプルな形式にマップ
  const therapistsForWeekly = therapists.map(t => ({ id: t.id, name: t.name, reservation_interval_minutes: t.intervalMinutes ?? null }));

  return (
    <div className="min-h-screen bg-gray-100 p-2 md:p-8">
      <div className="w-full mx-auto">
        <div className="mb-2 md:mb-8">
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">スケジュール</h1>
          <p className="text-xs md:text-sm text-slate-500">
            {viewMode === 'day' ? 'タイムチャート表示' : '週間表示'}
          </p>
        </div>

        {/* フィルターと表示切り替え */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 md:p-4 mb-2 md:mb-6">
          <div className="flex flex-col gap-2">
            {/* ビュー切り替えトグル */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg gap-1 self-start">
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                  viewMode === 'day'
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                タイムチャート
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                  viewMode === 'week'
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                週間表示
              </button>
            </div>

            {/* 並び替えモード */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start">
                {([
                  { key: 'shift', label: '出勤時間順' },
                  { key: 'room', label: 'ルーム順' },
                  { key: 'reservation', label: '受付時間順' },
                ] as { key: SortMode; label: string }[]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSortMode(key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                      sortMode === key
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

            {/* 日付ナビゲーション */}
            <div className="flex gap-1 items-center bg-slate-50 p-1 rounded-lg border border-slate-200 w-fit">
              {viewMode === 'day' ? (
                <>
                  <button
                    onClick={handlePrevDay}
                    className="px-2 py-1.5 bg-white text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md text-xs font-bold shadow-sm border border-slate-200 transition-colors whitespace-nowrap"
                  >
                    ← 前日
                  </button>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-auto px-2 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm text-xs"
                  />
                  <button
                    onClick={handleNextDay}
                    className="px-2 py-1.5 bg-white text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md text-xs font-bold shadow-sm border border-slate-200 transition-colors whitespace-nowrap"
                  >
                    翌日 →
                  </button>
                  <button
                    onClick={() => setFilterDate(new Date().toISOString().split('T')[0])}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 shadow-sm transition-colors font-bold text-xs whitespace-nowrap"
                  >
                    本日
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setWeekStartDate(new Date(weekStartDate.getTime() - 7 * 86400000))}
                    className="px-2 py-1.5 bg-white text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md text-xs font-bold shadow-sm border border-slate-200 transition-colors whitespace-nowrap"
                  >
                    ← 前週
                  </button>
                  <span className="flex-1 min-w-0 px-2 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-md text-xs shadow-sm text-center truncate">
                    {[weekStartDate].map(d => {
                      const end = new Date(d.getTime() + 6 * 86400000);
                      return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} 〜 ${String(end.getMonth()+1).padStart(2,'0')}/${String(end.getDate()).padStart(2,'0')}`;
                    })[0]}
                  </span>
                  <button
                    onClick={() => setWeekStartDate(new Date(weekStartDate.getTime() + 7 * 86400000))}
                    className="px-2 py-1.5 bg-white text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md text-xs font-bold shadow-sm border border-slate-200 transition-colors whitespace-nowrap"
                  >
                    翌週 →
                  </button>
                  <button
                    onClick={() => setWeekStartDate(getBusinessDate())}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 shadow-sm transition-colors font-bold text-xs whitespace-nowrap"
                  >
                    今週
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ローディング（日表示のみ） */}
        {viewMode === 'day' && loading && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        )}

        {/* タイムチャートビュー */}
        {viewMode === 'day' && !loading && (() => {
          const chartHeight = 56 + sortedTherapistsWithShift.length * 72 + 10;
          return (
            <div className="bg-white rounded-lg shadow-lg overflow-visible">
              <div style={{ height: `${Math.max(chartHeight, 200)}px` }} className="w-full">
                {sortedTherapistsWithShift.length > 0 ? (
                  <TimeChart
                    therapists={sortedTherapistsWithShift}
                    schedules={schedules}
                    date={filterDate}
                    onBlockedClick={(id, startTime, endTime) =>
                      setBlockedModal({ id, startTime, endTime })
                    }
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    シフトがあるセラピストがいません
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* 週間表示ビュー */}
        {viewMode === 'week' && (
          <WeeklyDayView
            therapists={therapistsForWeekly}
            weekStartDate={weekStartDate}
            sortMode={sortMode}
            roomOrderMap={roomOrderMap}
            shopIntervalMinutes={shopIntervalMinutes}
            onDayClick={(date) => {
              setFilterDate(date);
              setViewMode('day');
            }}
          />
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
