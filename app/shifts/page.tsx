"use client";

import { useState, useEffect, useMemo } from 'react';
import TimeSelectHM from '../components/TimeSelectHM';
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
  notes?: string | null;
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
  discount_amount: number;
  designation_type: string;
  is_hime: boolean | null;
  notes?: string | null;
  customers: { name: string; created_at: string } | null;
  courses: { name: string; duration: number } | null;
}

interface Room {
  id: string;
  name: string;
}

interface TherapistRow {
  id: string;
  name: string;
  reservation_interval_minutes: number | null;
  age?: number | null;
  height?: number | null;
  bust?: number | null;
  bust_cup?: string | null;
  waist?: number | null;
  hip?: number | null;
  comment?: string | null;
}

type SortMode = 'shift' | 'room' | 'reservation'

interface TherapistMemo {
  id: string;
  date: string;
  content: string;
  amount: number;
}

interface Therapist {
  id: string;
  name: string;
  avatar?: string;
  shiftStart?: string;
  shiftEnd?: string;
  roomId?: string | null;
  room?: string;
  roomMemo?: string | null;
  roomMapUrl?: string | null;
  age?: number | null;
  height?: number | null;
  bust?: number | null;
  bustCup?: string | null;
  waist?: number | null;
  hip?: number | null;
  staffMemo?: string | null;
  intervalMinutes?: number | null;
  notes?: string | null;
  unresolvedMemos?: TherapistMemo[];
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
  discountAmount?: number;
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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [shopIntervalMinutes, setShopIntervalMinutes] = useState<number>(20);
  const [filterDate, setFilterDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => getBusinessDate());
  const [loading, setLoading] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>('shift');
  const [roomOrderMap, setRoomOrderMap] = useState<Map<string, number>>(new Map());
  const [minCourseDuration, setMinCourseDuration] = useState<number>(0);

  // 予約不可編集モーダル
  const [blockedModal, setBlockedModal] = useState<{
    id: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  // メモ追加フォーム
  const [memoForm, setMemoForm] = useState<{ content: string; amount: string } | null>(null);

  const handleAddMemo = async (therapistId: string) => {
    if (!memoForm || !selectedShop || !memoForm.content.trim()) return;
    const { data, error } = await supabase.from('therapist_memos').insert([{
      therapist_id: therapistId,
      shop_id: selectedShop.id,
      date: filterDate,
      content: memoForm.content.trim(),
      amount: parseInt(memoForm.amount || '0', 10) || 0,
    }]).select('id, date, content, amount').single();
    if (error) { alert('メモの追加に失敗しました'); return; }
    setMemoForm(null);
    setShiftEditModal(m => m ? {
      ...m,
      unresolvedMemos: [{ id: data.id, date: data.date, content: data.content, amount: data.amount }, ...(m.unresolvedMemos || [])],
    } : null);
    setRefreshCounter(c => c + 1);
  };

  const handleResolveMemo = async (memoId: string, therapistId: string) => {
    const { error } = await supabase.from('therapist_memos').update({ is_resolved: true }).eq('id', memoId);
    if (error) { alert('解決済みの更新に失敗しました'); return; }
    setShiftEditModal(m => m ? {
      ...m,
      unresolvedMemos: (m.unresolvedMemos || []).filter(memo => memo.id !== memoId),
    } : null);
    setRefreshCounter(c => c + 1);
  };

  // シフト編集モーダル
  const [shiftEditModal, setShiftEditModal] = useState<{
    therapistId: string;
    therapistName: string;
    date: string;
    shiftId: string | null;
    startTime: string;
    endTime: string;
    roomId: string;
    isOff: boolean;
    memo: string;
    saving: boolean;
    error: string;
    unresolvedMemos: TherapistMemo[];
    blockedSlots: { startTime: string; endTime: string }[];
    addingBlocked: boolean;
    newBlockedStart: string;
    newBlockedEnd: string;
  } | null>(null);

  const handleBlockedDelete = async (id: string) => {
    if (!confirm('この予約不可ブロックを削除しますか？')) return;
    const { error } = await supabase.from('reservations').delete().eq('id', id);
    if (error) { alert('削除に失敗しました'); return; }
    setBlockedModal(null);
    setRefreshCounter(c => c + 1);
  };

  const handleOpenShiftEdit = async (therapistId: string, date?: string) => {
    if (!selectedShop) return;
    const targetDate = date ?? filterDate;
    const therapistName = therapists.find(t => t.id === therapistId)?.name ?? '';

    const [shiftRes, allBlockedRes, memosRes] = await Promise.all([
      supabase.from('shifts').select('id, start_time, end_time, room_id, notes')
        .eq('therapist_id', therapistId).eq('date', targetDate).eq('shop_id', selectedShop.id).limit(1),
      supabase.from('reservations').select('id, start_time, end_time, notes')
        .eq('therapist_id', therapistId).eq('date', targetDate).eq('shop_id', selectedShop.id).eq('status', 'blocked'),
      supabase.from('therapist_memos').select('id, date, content, amount')
        .eq('therapist_id', therapistId).eq('shop_id', selectedShop.id).eq('is_resolved', false)
        .order('date', { ascending: false }),
    ]);

    const shift = shiftRes.data?.[0];
    const allBlocked = allBlockedRes.data || [];
    const shiftStartStr = shift ? shift.start_time.slice(0, 5) : null;
    const shiftEndStr = shift ? shift.end_time.slice(0, 5) : null;

    let isOff = false;
    let offMemo = '';
    const blockedSlots: { startTime: string; endTime: string }[] = [];

    for (const bl of allBlocked) {
      const blStart = bl.start_time.slice(0, 5);
      const blEnd = bl.end_time.slice(0, 5);
      if (shiftStartStr && shiftEndStr && blStart === shiftStartStr && blEnd === shiftEndStr) {
        isOff = true;
        offMemo = bl.notes ?? '';
      } else {
        blockedSlots.push({ startTime: blStart, endTime: blEnd });
      }
    }

    const defaultStart = shift ? shift.start_time.slice(0, 5) : '10:00';
    const defaultEnd = shift ? shift.end_time.slice(0, 5) : '18:00';

    const unresolvedMemos: TherapistMemo[] = (memosRes.data || []).map((m: any) => ({
      id: m.id, date: m.date, content: m.content, amount: m.amount,
    }));

    setMemoForm(null);
    setShiftEditModal({
      therapistId,
      therapistName,
      date: targetDate,
      shiftId: shift?.id ?? null,
      startTime: defaultStart,
      endTime: defaultEnd,
      roomId: shift?.room_id ?? '',
      isOff,
      memo: isOff ? offMemo : (shift?.notes ?? ''),
      saving: false,
      error: '',
      unresolvedMemos,
      blockedSlots,
      addingBlocked: false,
      newBlockedStart: defaultStart,
      newBlockedEnd: defaultEnd,
    });
  };

  const handleAddBlockedSlot = () => {
    setShiftEditModal(m => {
      if (!m || !m.newBlockedStart || !m.newBlockedEnd) return m;
      return {
        ...m,
        blockedSlots: [...m.blockedSlots, { startTime: m.newBlockedStart, endTime: m.newBlockedEnd }],
        addingBlocked: false,
      };
    });
  };

  const handleSaveShiftEdit = async () => {
    if (!shiftEditModal || !selectedShop) return;
    const { therapistId, date, shiftId, startTime, endTime, roomId, isOff, memo, blockedSlots } = shiftEditModal;
    setShiftEditModal(m => m ? { ...m, saving: true, error: '' } : null);

    const toDbTime = (t: string) => {
      const [h, min] = t.split(':').map(Number);
      return `${String(h % 24).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
    };

    const shiftPayload: any = {
      therapist_id: therapistId,
      shop_id: selectedShop.id,
      date,
      room_id: roomId || null,
      start_time: toDbTime(startTime),
      end_time: toDbTime(endTime),
      notes: isOff ? null : (memo || null),
    };

    let shiftError: any = null;
    if (shiftId) {
      const { error } = await supabase.from('shifts').update(shiftPayload).eq('id', shiftId);
      shiftError = error;
    } else {
      const { error } = await supabase.from('shifts').insert([shiftPayload]);
      shiftError = error;
    }
    if (shiftError) {
      setShiftEditModal(m => m ? { ...m, saving: false, error: '保存に失敗しました: ' + shiftError.message } : null);
      return;
    }

    await supabase.from('reservations').delete()
      .eq('shop_id', selectedShop.id)
      .eq('therapist_id', therapistId)
      .eq('date', date)
      .eq('status', 'blocked');

    if (isOff) {
      const { error } = await supabase.from('reservations').insert([{
        therapist_id: therapistId,
        shop_id: selectedShop.id,
        date,
        start_time: toDbTime(startTime),
        end_time: toDbTime(endTime),
        status: 'blocked',
        course_id: null,
        customer_id: null,
        base_price: 0,
        options_price: 0,
        nomination_fee: 0,
        total_price: 0,
        discount_amount: 0,
        designation_type: 'free',
        notes: memo || null,
      }]);
      if (error) {
        setShiftEditModal(m => m ? { ...m, saving: false, error: '受付不可の設定に失敗しました' } : null);
        return;
      }
    } else if (blockedSlots.length > 0) {
      const { error } = await supabase.from('reservations').insert(
        blockedSlots.map(slot => ({
          therapist_id: therapistId,
          shop_id: selectedShop.id,
          date,
          start_time: toDbTime(slot.startTime),
          end_time: toDbTime(slot.endTime),
          status: 'blocked',
          course_id: null,
          customer_id: null,
          base_price: 0,
          options_price: 0,
          nomination_fee: 0,
          total_price: 0,
          discount_amount: 0,
          designation_type: 'free',
          notes: null,
        }))
      );
      if (error) {
        setShiftEditModal(m => m ? { ...m, saving: false, error: '予約不可の設定に失敗しました' } : null);
        return;
      }
    }

    setShiftEditModal(null);
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
      .select('id, name, order')
      .eq('shop_id', selectedShop.id)
      .order('order', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        const map = new Map<string, number>();
        (data || []).forEach((r: any, i: number) => map.set(r.id, r.order ?? i));
        setRoomOrderMap(map);
        setRooms((data || []).map((r: any) => ({ id: r.id, name: r.name })));
      });
  }, [selectedShop, refreshCounter]);

  useEffect(() => {
    if (!selectedShop) return;
    supabase
      .from('courses')
      .select('duration')
      .eq('shop_id', selectedShop.id)
      .eq('is_active', true)
      .then(({ data }) => {
        const durations = (data || []).map((c: any) => c.duration).filter((d: number) => d > 0);
        setMinCourseDuration(durations.length > 0 ? Math.min(...durations) : 0);
      });
  }, [selectedShop]);

  const fetchTherapists = async () => {
    if (!selectedShop) return;
    try {
      let allTherapists: TherapistRow[] = [];
      const { data: therapistsWithInterval, error: therapistsError } = await supabase
        .from('therapists')
        .select('id, name, reservation_interval_minutes, age, height, bust, bust_cup, waist, hip, comment')
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
        .select('therapist_id, room_id, rooms(name, memo, google_map_url), start_time, end_time, notes')
        .eq('shop_id', selectedShop.id)
        .eq('date', filterDate);

      if (shiftsError) {
        console.error('Error fetching shifts:', shiftsError);
        return;
      }

      const shiftsMap = new Map<string, { therapist_id: string; room_id: string | null; start_time: string | null; end_time: string | null; notes?: string | null; rooms: { name: string; memo?: string | null; google_map_url?: string | null } | null }>();
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
          roomMemo: shift?.rooms?.memo ?? null,
          roomMapUrl: shift?.rooms?.google_map_url ?? null,
          age: therapist.age ?? null,
          height: therapist.height ?? null,
          bust: therapist.bust ?? null,
          bustCup: therapist.bust_cup ?? null,
          waist: therapist.waist ?? null,
          hip: therapist.hip ?? null,
          staffMemo: therapist.comment ?? null,
          intervalMinutes: therapist.reservation_interval_minutes ?? shopInterval,
          notes: shift?.notes ?? null,
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

      // 未解決メモをセラピストごとにマージ
      const { data: memosData } = await supabase
        .from('therapist_memos')
        .select('id, therapist_id, date, content, amount')
        .eq('shop_id', selectedShop.id)
        .eq('is_resolved', false)
        .order('date', { ascending: false });

      const memosMap = new Map<string, TherapistMemo[]>();
      (memosData || []).forEach((m: any) => {
        const list = memosMap.get(m.therapist_id) || [];
        list.push({ id: m.id, date: m.date, content: m.content, amount: m.amount });
        memosMap.set(m.therapist_id, list);
      });

      const withMemos = (therapistsWithShift as Therapist[]).map(t => ({
        ...t,
        unresolvedMemos: memosMap.get(t.id) || [],
      }));

      setTherapists(withMemos);
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
      .select('id, therapist_id, room_id, date, start_time, end_time, notes, therapists(name), rooms(name)')
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
          discount_amount,
          designation_type,
          is_hime,
          notes,
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
        discountAmount: reservation.discount_amount > 0 ? reservation.discount_amount : undefined,
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
        // インターバル開始がシフト終了以降なら非表示
        if (therapist?.shiftEnd) {
          let shiftEndMin = hhmToMinutes(therapist.shiftEnd);
          const shiftStartMin = hhmToMinutes(therapist.shiftStart || '00:00');
          if (shiftEndMin <= shiftStartMin) shiftEndMin += 24 * 60;
          if (endMin >= shiftEndMin) return [];
        }
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
    // blockedのメモを優先してnotesをマージ
    const withShift = therapists.filter(t => t.shiftStart && t.shiftEnd).map(t => {
      const blockedNote = reservations.find(r => r.therapist_id === t.id && r.status === 'blocked')?.notes;
      return blockedNote != null ? { ...t, notes: blockedNote } : t;
    });

    // 休み（全日受付不可）= シフト全時間帯と一致するblockedスロットを持つ
    const isOff = (t: Therapist) => {
      if (!t.shiftStart || !t.shiftEnd) return false;
      return reservations.some(r =>
        r.status === 'blocked' &&
        r.therapist_id === t.id &&
        r.start_time.slice(0, 5) === t.shiftStart &&
        r.end_time.slice(0, 5) === t.shiftEnd
      );
    };

    if (sortMode === 'shift') {
      return [...withShift].sort((a, b) => {
        if (isOff(a) !== isOff(b)) return isOff(a) ? 1 : -1;
        return hhmToMinutes(a.shiftStart || '99:99') - hhmToMinutes(b.shiftStart || '99:99');
      });
    }
    if (sortMode === 'room') {
      return [...withShift].sort((a, b) => {
        if (isOff(a) !== isOff(b)) return isOff(a) ? 1 : -1;
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

      const isEffectivelyFinished = (t: Therapist): boolean => {
        if (!t.shiftEnd) return false;
        const shiftEndMins = getShiftEndMins(t);
        if (currentMins >= shiftEndMins) return true;
        const interval = t.intervalMinutes ?? shopIntervalMinutes;
        const therapistReservations = reservations.filter(
          (r: any) => r.therapist_id === t.id && r.status === 'confirmed'
        );
        const lastEndMins = therapistReservations.length > 0
          ? Math.max(...therapistReservations.map((r: any) => hhmToMinutes(r.end_time.slice(0, 5))))
          : null;
        // 次に予約を受け付けられる開始時刻
        const nextAvailableMins = lastEndMins !== null
          ? Math.max(currentMins, lastEndMins + interval)
          : currentMins;
        // 最短コースが入らなければ受付終了
        const requiredMins = minCourseDuration > 0 ? minCourseDuration : 1;
        return nextAvailableMins + requiredMins > shiftEndMins;
      };

      const earliestMap = new Map<string, number>();
      reservations.filter((r: any) => r.status === 'confirmed').forEach(r => {
        const mins = hhmToMinutes(r.start_time.slice(0, 5));
        const cur = earliestMap.get(r.therapist_id) ?? 9999;
        if (mins < cur) earliestMap.set(r.therapist_id, mins);
      });
      return [...withShift].sort((a, b) => {
        if (isOff(a) !== isOff(b)) return isOff(a) ? 1 : -1;
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
  }, [therapists, sortMode, roomOrderMap, reservations, shopIntervalMinutes, minCourseDuration]);

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
                    onShiftEditOpen={handleOpenShiftEdit}
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
            minCourseDuration={minCourseDuration}
            onDayClick={(date) => {
              setFilterDate(date);
              setViewMode('day');
            }}
            onShiftEditOpen={handleOpenShiftEdit}
          />
        )}
      </div>

      {/* シフト編集モーダル */}
      {shiftEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShiftEditModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            {/* ヘッダー */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800">{shiftEditModal.therapistName}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">シフト編集 — {shiftEditModal.date}</p>
                </div>
                <button onClick={() => setShiftEditModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* 出退勤時間 */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">出勤時間</label>
                  <TimeSelectHM
                    value={shiftEditModal.startTime}
                    onChange={v => setShiftEditModal(m => m ? { ...m, startTime: v } : null)}
                    disabled={shiftEditModal.isOff}
                    selectClassName="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">退勤時間</label>
                  <TimeSelectHM
                    value={shiftEditModal.endTime}
                    onChange={v => setShiftEditModal(m => m ? { ...m, endTime: v } : null)}
                    disabled={shiftEditModal.isOff}
                    selectClassName="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none disabled:opacity-40"
                  />
                </div>
              </div>

              {/* ルーム */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">ルーム</label>
                <select
                  value={shiftEditModal.roomId}
                  onChange={e => setShiftEditModal(m => m ? { ...m, roomId: e.target.value } : null)}
                  disabled={shiftEditModal.isOff}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none disabled:opacity-40"
                >
                  <option value="">未設定</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* 休みチェックボックス */}
              <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors select-none"
                style={shiftEditModal.isOff ? { borderColor: '#9b1c1c', background: '#fff1f2' } : { borderColor: '#e2e8f0', background: '#f8fafc' }}>
                <input
                  type="checkbox"
                  checked={shiftEditModal.isOff}
                  onChange={e => setShiftEditModal(m => m ? { ...m, isOff: e.target.checked } : null)}
                  className="w-4 h-4 rounded accent-red-800"
                />
                <div>
                  <p className={`text-sm font-bold ${shiftEditModal.isOff ? 'text-red-800' : 'text-slate-700'}`}>休み（全日受付不可）</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">チェックするとシフト全時間帯が受付不可になります</p>
                </div>
              </label>

              {/* 予約不可時間帯 */}
              {!shiftEditModal.isOff && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-800 inline-block"></span>
                      予約不可時間帯
                    </label>
                    <button
                      onClick={() => setShiftEditModal(m => m ? { ...m, addingBlocked: !m.addingBlocked } : null)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      {shiftEditModal.addingBlocked ? 'キャンセル' : '＋ 追加'}
                    </button>
                  </div>

                  {shiftEditModal.addingBlocked && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">開始時刻</label>
                          <TimeSelectHM
                            value={shiftEditModal.newBlockedStart}
                            onChange={v => setShiftEditModal(m => m ? { ...m, newBlockedStart: v } : null)}
                            selectClassName="flex-1 px-2 py-2 bg-white border border-rose-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-400/50 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-1">終了時刻</label>
                          <TimeSelectHM
                            value={shiftEditModal.newBlockedEnd}
                            onChange={v => setShiftEditModal(m => m ? { ...m, newBlockedEnd: v } : null)}
                            selectClassName="flex-1 px-2 py-2 bg-white border border-rose-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-400/50 outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={handleAddBlockedSlot}
                          disabled={!shiftEditModal.newBlockedStart || !shiftEditModal.newBlockedEnd}
                          className="px-4 py-1.5 bg-red-800 text-white text-xs font-bold rounded-lg hover:bg-red-900 transition-colors disabled:opacity-40"
                        >
                          追加
                        </button>
                      </div>
                    </div>
                  )}

                  {shiftEditModal.blockedSlots.length > 0 && (
                    <div className="space-y-1.5">
                      {shiftEditModal.blockedSlots.map((slot, i) => (
                        <div key={i} className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                          <span className="text-xs font-bold text-rose-800 flex-1">{slot.startTime} ～ {slot.endTime}</span>
                          <button
                            onClick={() => setShiftEditModal(m => m ? { ...m, blockedSlots: m.blockedSlots.filter((_, j) => j !== i) } : null)}
                            className="text-rose-400 hover:text-rose-600 transition-colors p-0.5"
                            title="削除"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {shiftEditModal.blockedSlots.length === 0 && !shiftEditModal.addingBlocked && (
                    <p className="text-xs text-slate-400 text-center py-1.5">予約不可の時間帯はありません</p>
                  )}
                </div>
              )}

              {/* メモ */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">メモ</label>
                <textarea
                  value={shiftEditModal.memo}
                  onChange={e => setShiftEditModal(m => m ? { ...m, memo: e.target.value } : null)}
                  rows={2}
                  placeholder="備考・連絡事項など"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none resize-none"
                />
              </div>

              {shiftEditModal.error && (
                <p className="text-xs text-red-600 font-medium">{shiftEditModal.error}</p>
              )}
            </div>

            {/* 引き継ぎメモセクション */}
            <div className="px-6 pb-4 border-t border-slate-100">
              <div className="flex items-center justify-between mt-4 mb-2">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  引き継ぎメモ
                  {shiftEditModal.unresolvedMemos.length > 0 && (
                    <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{shiftEditModal.unresolvedMemos.length}</span>
                  )}
                </h4>
                <button
                  onClick={() => setMemoForm(f => f ? null : { content: '', amount: '' })}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  {memoForm ? 'キャンセル' : '＋ 追加'}
                </button>
              </div>

              {/* 追加フォーム */}
              {memoForm && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 space-y-2">
                  <textarea
                    value={memoForm.content}
                    onChange={e => setMemoForm(f => f ? { ...f, content: e.target.value } : null)}
                    rows={2}
                    placeholder="内容（例：精算時に店落ち不足）"
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400/50 outline-none resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="number"
                        value={memoForm.amount}
                        onChange={e => setMemoForm(f => f ? { ...f, amount: e.target.value } : null)}
                        placeholder="金額"
                        className="w-24 px-2 py-1.5 bg-white border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400/50 outline-none"
                      />
                      <span className="text-xs text-slate-500">円　正=余剰 / 負=不足</span>
                    </div>
                    <button
                      onClick={() => handleAddMemo(shiftEditModal.therapistId)}
                      disabled={!memoForm.content.trim()}
                      className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-40"
                    >
                      追加
                    </button>
                  </div>
                </div>
              )}

              {/* 未解決メモ一覧 */}
              {shiftEditModal.unresolvedMemos.length === 0 && !memoForm && (
                <p className="text-xs text-slate-400 text-center py-2">未解決のメモはありません</p>
              )}
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {shiftEditModal.unresolvedMemos.map(memo => (
                  <div key={memo.id} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] text-amber-700 font-bold">{memo.date}</span>
                        {memo.amount !== 0 && (
                          <span className={`text-[10px] font-bold px-1.5 rounded ${memo.amount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                            {memo.amount > 0 ? `+${memo.amount.toLocaleString()}` : memo.amount.toLocaleString()}円
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 leading-snug">{memo.content}</p>
                    </div>
                    <button
                      onClick={() => handleResolveMemo(memo.id, shiftEditModal.therapistId)}
                      className="flex-shrink-0 text-[9px] font-bold text-slate-400 hover:text-emerald-600 border border-slate-200 hover:border-emerald-300 px-1.5 py-1 rounded transition-colors whitespace-nowrap"
                    >
                      解決済み
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* フッター */}
            <div className="px-6 pb-6 flex gap-2">
              <button
                onClick={handleSaveShiftEdit}
                disabled={shiftEditModal.saving}
                className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm"
              >
                {shiftEditModal.saving ? '保存中...' : '保存する'}
              </button>
              <button
                onClick={() => setShiftEditModal(null)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 予約不可編集モーダル */}
      {blockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setBlockedModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-6">予約不可ブロックの編集</h3>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">開始時刻</label>
                <TimeSelectHM
                  value={blockedModal.startTime}
                  onChange={v => setBlockedModal({ ...blockedModal, startTime: v })}
                  selectClassName="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">終了時刻</label>
                <TimeSelectHM
                  value={blockedModal.endTime}
                  onChange={v => setBlockedModal({ ...blockedModal, endTime: v })}
                  selectClassName="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
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
