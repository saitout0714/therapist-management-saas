"use client";

import { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import TimeSelectHM from '@/app/components/TimeSelectHM';
import { supabase } from '@/lib/supabase';
import { useShop } from '@/app/contexts/ShopContext';
import { useAuth } from '@/app/contexts/AuthContext';
import TimeChart from '@/app/components/TimeChart';
import VerticalTimeChart from '@/app/components/VerticalTimeChart';
import WeeklyDayView from '@/app/components/WeeklyDayView';
import { toDisplayTime } from '@/lib/timeUtils';
import { getPricingShopId } from '@/lib/shopUtils';
import ShiftRequestDrawer from '@/app/components/ShiftRequestDrawer';


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
  payment_method: string | null;
  options_payment_method?: string | null;
  extension_payment_method?: string | null;
  payment_settled_at?: string | null;
  customers: { name: string; created_at: string } | null;
  courses: { name: string; duration: number } | null;
  is_handled?: boolean;
  source?: string;
  reception_source?: string | null;
  booking_method?: string | null;
  customer_notified?: boolean;
  therapist_notified?: boolean;
  extension_count?: number;
  shop_id?: string;
  isNewCustomer?: boolean;
}

interface Room {
  id: string;
  name: string;
  linked_room_group_id?: string | null;
  type?: string;
  address?: string | null;
  memo?: string | null;
  google_map_url?: string | null;
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
  staff_memo?: string | null;
  linked_therapist_group_id?: string | null;
  therapist_ranks?: { name: string } | { name: string }[] | null;
  is_rookie?: boolean;
}

type SortMode = 'shift' | 'room' | 'reservation'

interface TherapistMemo {
  id: string;
  date: string;
  content: string;
  amount: number;
  resolved_at?: string | null;
  resolved_date?: string | null;
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
  roomDisplayName?: string | null;
  roomAddress?: string | null;
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
  linked_therapist_group_id?: string | null;
  linked_shop_names?: string[];
  rankName?: string | null;
  isRookie?: boolean;
  receptionClosedFrom?: string | null;
  receptionClosedReservationId?: string | null;
  isSettled?: boolean;
}

interface AvailableCourse {
  duration: number;
  startTime: string;
  endTime: string;
  latestStartTime: string;
  color: string;
  borderColor: string;
  textColor: string;
  label: string;
}

interface Schedule {
  therapistId: string;
  startTime: string; // "HH:mm" format
  endTime: string;
  title: string;
  color?: string;
  type?: 'shift' | 'reservation' | 'interval' | 'blocked' | 'available' | 'unavailable';
  reservationId?: string;
  customerId?: string;
  customerName?: string;
  courseDuration?: number;
  designationLabel?: string;
  totalPrice?: number;
  discountAmount?: number;
  isNewCustomer?: boolean;
  isHime?: boolean;
  isPending?: boolean;
  isHandled?: boolean;
  source?: string;
  receptionSource?: string | null;
  bookingMethod?: string | null;
  paymentMethod?: string | null;
  customerNotified?: boolean;
  therapistNotified?: boolean;
  extensionMinutes?: number;
  availableCourses?: AvailableCourse[];
  optionsPaymentMethod?: string | null;
  extensionPaymentMethod?: string | null;
  paymentSettledAt?: string | null;
}

type ViewMode = 'day' | 'vertical' | 'week';

const getBusinessDate = () => {
  const now = new Date()
  if (now.getHours() < 6) now.setDate(now.getDate() - 1)
  return now
}

// 営業日切替時刻（AM6:00）を考慮した「本日」の日付文字列 (YYYY-MM-DD) を返す。
// getTodayJST() は暦日の0:00で切り替わってしまうため、深夜営業中に日付表示が
// 早送りされる不具合の原因になっていた。
const getBusinessDateStr = () => {
  const d = getBusinessDate()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function ShiftsContent() {
  const { selectedShop } = useShop();
  const { loading: authLoading, user } = useAuth();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('day');

  // Load saved view mode from localStorage on client-side mount
  useEffect(() => {
    const saved = localStorage.getItem('shifts_view_mode');
    if (saved === 'vertical' || saved === 'week' || saved === 'day') {
      const urlParams = new URLSearchParams(window.location.search);
      const viewParam = urlParams.get('view');
      if (!viewParam) {
        setViewMode(saved as ViewMode);
      }
    }
  }, []);

  // マウント直後の初回書き込み（読み込み完了前のデフォルト値）は保存済みの値を
  // 上書きしてしまうためスキップし、実際の変更のみを保存する
  const viewModeWriteSkippedRef = useRef(false);
  useEffect(() => {
    if (!viewModeWriteSkippedRef.current) {
      viewModeWriteSkippedRef.current = true;
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('shifts_view_mode', viewMode);
    }
  }, [viewMode]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [payrollEntries, setPayrollEntries] = useState<Map<string, { status: string; confirmed_at: string | null }>>(new Map());
  const [activeTooltip, setActiveTooltip] = useState<'rules' | 'hotels' | null>(null);
  const rulesRef = useRef<HTMLDivElement>(null);
  const hotelsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClose = (e: MouseEvent) => {
      if (
        (rulesRef.current && rulesRef.current.contains(e.target as Node)) ||
        (hotelsRef.current && hotelsRef.current.contains(e.target as Node))
      ) {
        return;
      }
      setActiveTooltip(null);
    };
    document.addEventListener('click', handleClose);
    return () => document.removeEventListener('click', handleClose);
  }, []);

  const [shopIntervalMinutes, setShopIntervalMinutes] = useState<number>(20);
  const [extensionUnitMinutes, setExtensionUnitMinutes] = useState<number>(30);
  const [filterDate, setFilterDate] = useState(() => {
    return getBusinessDateStr();
  });
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => getBusinessDate());

  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'week') {
      setViewMode('week');
    } else if (view === 'day') {
      setViewMode('day');
    } else if (view === 'vertical') {
      setViewMode('vertical');
    }

    const qDate = searchParams.get('date');
    if (qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate)) {
      setFilterDate(qDate);
      const parsedDate = new Date(qDate);
      if (!isNaN(parsedDate.getTime())) {
        setWeekStartDate(parsedDate);
      }
    }

    // URLクエリパラメータをクリアして、リロード時に今日・デフォルト表示に戻るようにする
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('date') || url.searchParams.has('scroll_to_time') || url.searchParams.has('view')) {
        url.searchParams.delete('date');
        url.searchParams.delete('scroll_to_time');
        url.searchParams.delete('view');
        window.history.replaceState(null, '', url.pathname + url.search);
      }
    }
  }, [searchParams]);

  // 店舗（selectedShop）が変更された場合、日付を今日（当日）に戻す
  const lastShopIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedShop) return;
    if (lastShopIdRef.current !== null && lastShopIdRef.current !== selectedShop.id) {
      setFilterDate(getBusinessDateStr());
      setWeekStartDate(getBusinessDate());
    }
    lastShopIdRef.current = selectedShop.id;
  }, [selectedShop]);
  const [loading, setLoading] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>('shift');

  // タイムチャートの高さをビューポートの残り高さいっぱいに追従させる
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartHeight, setChartHeight] = useState<number>(700);

  useEffect(() => {
    const updateChartHeight = () => {
      const el = chartContainerRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const nextHeight = Math.max(window.innerHeight - top - 16, 400);
      setChartHeight(nextHeight);
    };

    updateChartHeight();
    window.addEventListener('resize', updateChartHeight);
    return () => window.removeEventListener('resize', updateChartHeight);
  }, [viewMode, loading]);

  // Load saved sort mode from localStorage on client-side mount
  useEffect(() => {
    const saved = localStorage.getItem('shifts_sort_mode');
    if (saved === 'shift' || saved === 'room' || saved === 'reservation') {
      setSortMode(saved as SortMode);
    }
  }, []);

  // マウント直後の初回書き込み（読み込み完了前のデフォルト値）は保存済みの値を
  // 上書きしてしまうためスキップし、実際の変更のみを保存する
  const sortModeWriteSkippedRef = useRef(false);
  useEffect(() => {
    if (!sortModeWriteSkippedRef.current) {
      sortModeWriteSkippedRef.current = true;
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('shifts_sort_mode', sortMode);
    }
  }, [sortMode]);
  const [roomOrderMap, setRoomOrderMap] = useState<Map<string, number>>(new Map());
  const [minCourseDuration, setMinCourseDuration] = useState<number>(0);

  const [shopCourses, setShopCourses] = useState<{name: string, duration: number, price: number, showOnTimechart: boolean}[]>([]);
  const [shopDiscounts, setShopDiscounts] = useState<{name: string, value: number}[]>([]);
  const [shopDesignations, setShopDesignations] = useState<{name: string, fee: number}[]>([]);
  const [designationMap, setDesignationMap] = useState<Record<string, string>>({});
  const [shopOptions, setShopOptions] = useState<{name: string, price: number, duration: number, type: string}[]>([]);
  const [effectiveSpecialRules, setEffectiveSpecialRules] = useState<string | null>(null);





  // 予約不可編集モーダル
  const [blockedModal, setBlockedModal] = useState<{
    id: string;
    startTime: string;
    endTime: string;
    memo: string;
  } | null>(null);

  // 受付終了モーダル
  const [receptionCloseModal, setReceptionCloseModal] = useState<{
    therapistId: string;
    therapistName: string;
    date: string;
    shiftStart: string;
    shiftEnd: string;
    cutoffTime: string;
    saving: boolean;
  } | null>(null);

  // メモ追加フォーム
  const [memoForm, setMemoForm] = useState<{ content: string; amount: string } | null>(null);

  // 編集用の状態
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editMemoForm, setEditMemoForm] = useState<{ content: string; amount: string }>({ content: '', amount: '' });

  const handleAddMemo = async (therapistId: string) => {
    if (!memoForm || !selectedShop || !memoForm.content.trim()) return;
    const { data, error } = await supabase.from('therapist_memos').insert([{
      therapist_id: therapistId,
      shop_id: selectedShop.id,
      date: filterDate,
      content: memoForm.content.trim(),
      amount: parseInt(memoForm.amount || '0', 10) || 0,
    }]).select('id, date, content, amount').single();
    if (error) { alert('メモの追加に失敗しました: ' + error.message); return; }
    setMemoForm(null);
    setShiftEditModal(m => m ? {
      ...m,
      unresolvedMemos: [{ id: data.id, date: data.date, content: data.content, amount: data.amount }, ...(m.unresolvedMemos || [])],
    } : null);
    setRefreshCounter(c => c + 1);
  };

  const handleEditMemoStart = (memo: TherapistMemo) => {
    setEditingMemoId(memo.id);
    setEditMemoForm({
      content: memo.content ?? '',
      amount: memo.amount != null ? String(memo.amount) : ''
    });
  };

  const handleUpdateMemo = async (id: string) => {
    if (!editMemoForm.content.trim()) return;
    const { error } = await supabase
      .from('therapist_memos')
      .update({
        content: editMemoForm.content.trim(),
        amount: parseInt(editMemoForm.amount || '0', 10) || 0
      })
      .eq('id', id);

    if (error) {
      alert('メモの更新に失敗しました: ' + error.message);
      return;
    }

    setEditingMemoId(null);
    setShiftEditModal(m => m ? {
      ...m,
      unresolvedMemos: (m.unresolvedMemos || []).map(memo => memo.id === id ? { ...memo, content: editMemoForm.content.trim(), amount: parseInt(editMemoForm.amount || '0', 10) || 0 } : memo),
    } : null);
    setRefreshCounter(c => c + 1);
  };

  const handleResolveMemo = async (memoId: string, therapistId: string) => {
    const { error } = await supabase.from('therapist_memos').update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_date: filterDate
    }).eq('id', memoId);
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
    blockedSlots: { startTime: string; endTime: string; memo: string }[];
    addingBlocked: boolean;
    newBlockedStart: string;
    newBlockedEnd: string;
    newBlockedMemo: string;
    isSettled: boolean;
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
      supabase.from('therapist_memos').select('id, date, content, amount, resolved_at, resolved_date')
        .eq('therapist_id', therapistId).eq('shop_id', selectedShop.id).eq('is_resolved', false)
        .order('date', { ascending: false }),
    ]);

    const shift = shiftRes.data?.[0];
    const allBlocked = allBlockedRes.data || [];
    const shiftStartStr = shift ? toDisplayTime(shift.start_time) : null;
    const shiftEndStr = shift ? toDisplayTime(shift.end_time) : null;

    let isOff = false;
    let offMemo = '';
    const blockedSlots: { startTime: string; endTime: string; memo: string }[] = [];

    for (const bl of allBlocked) {
      const blStart = toDisplayTime(bl.start_time);
      const blEnd = toDisplayTime(bl.end_time);
      if (shiftStartStr && shiftEndStr && blStart === shiftStartStr && blEnd === shiftEndStr) {
        isOff = true;
        offMemo = bl.notes ?? '';
      } else {
        blockedSlots.push({ startTime: blStart, endTime: blEnd, memo: bl.notes ?? '' });
      }
    }

    const defaultStart = shift ? toDisplayTime(shift.start_time) : '10:00';
    const defaultEnd = shift ? toDisplayTime(shift.end_time) : '18:00';

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
      newBlockedMemo: '',
      isSettled: payrollEntries.get(therapistId)?.status === 'paid',
    });
  };

  const handleAddBlockedSlot = () => {
    setShiftEditModal(m => {
      if (!m || !m.newBlockedStart || !m.newBlockedEnd) return m;
      return {
        ...m,
        blockedSlots: [...m.blockedSlots, { startTime: m.newBlockedStart, endTime: m.newBlockedEnd, memo: m.newBlockedMemo }],
        addingBlocked: false,
        newBlockedMemo: '',
      };
    });
  };

  const handleSaveShiftEdit = async () => {
    if (!shiftEditModal || !selectedShop) return;
    const { therapistId, date, shiftId, startTime, endTime, roomId, isOff, memo, blockedSlots } = shiftEditModal;
    setShiftEditModal(m => m ? { ...m, saving: true, error: '' } : null);

    const toDbTime = (t: string) => {
      const [h, min] = t.split(':').map(Number);
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
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
          notes: slot.memo?.trim() || null,
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
      notes: blockedModal.memo.trim() || null,
    }).eq('id', blockedModal.id);
    if (error) { alert('更新に失敗しました'); return; }
    setBlockedModal(null);
    setRefreshCounter(c => c + 1);
  };

  // 受付終了に該当セラピストの現在時刻以降の確定予約があるかチェックする
  // （受付終了ブロックの「予約不可」判定は既存の重複チェックロジックと同様、警告のみで強制はしない）
  const findConfirmedConflicts = (therapistId: string, cutoffTime: string) => {
    const cutoffMins = hhmToMinutes(cutoffTime);
    return reservations.filter(r =>
      r.therapist_id === therapistId &&
      r.status === 'confirmed' &&
      hhmToMinutes(toDisplayTime(r.start_time)) >= cutoffMins
    );
  };

  const getNowExtendedTime = () => {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return toDisplayTime(hhmm);
  };

  const handleOpenReceptionClose = (therapistId: string, therapistName: string, date: string, shiftStart: string, shiftEnd: string) => {
    const shiftStartMins = hhmToMinutes(shiftStart);
    const shiftEndMins = hhmToMinutes(shiftEnd);
    let cutoffMins = hhmToMinutes(getNowExtendedTime());
    if (cutoffMins < shiftStartMins) cutoffMins = shiftStartMins;
    if (cutoffMins > shiftEndMins) cutoffMins = shiftEndMins;
    setReceptionCloseModal({
      therapistId,
      therapistName,
      date,
      shiftStart,
      shiftEnd,
      cutoffTime: minutesToHHMM(cutoffMins),
      saving: false,
    });
  };

  const handleConfirmReceptionClose = async () => {
    if (!receptionCloseModal || !selectedShop) return;
    const { therapistId, date, cutoffTime, shiftEnd } = receptionCloseModal;

    const conflicts = findConfirmedConflicts(therapistId, cutoffTime);
    if (conflicts.length > 0) {
      const list = conflicts.map(r => `${toDisplayTime(r.start_time)} ${r.customers?.name || 'ゲスト'}`).join('\n');
      if (!confirm(`【警告】${cutoffTime}以降に既存の予約があります:\n\n${list}\n\nこのまま受付終了にしますか？`)) return;
    }

    setReceptionCloseModal(m => m ? { ...m, saving: true } : null);
    const { error } = await supabase.from('reservations').insert([{
      therapist_id: therapistId,
      shop_id: selectedShop.id,
      date,
      start_time: cutoffTime,
      end_time: shiftEnd,
      status: 'blocked',
      course_id: null,
      customer_id: null,
      base_price: 0,
      options_price: 0,
      nomination_fee: 0,
      total_price: 0,
      discount_amount: 0,
      designation_type: 'free',
      notes: '受付終了',
    }]);
    if (error) {
      alert('受付終了の設定に失敗しました: ' + error.message);
      setReceptionCloseModal(m => m ? { ...m, saving: false } : null);
      return;
    }
    setReceptionCloseModal(null);
    setRefreshCounter(c => c + 1);
  };

  const handleClearReceptionClosed = async (reservationId: string) => {
    if (!confirm('受付終了を解除しますか？')) return;
    const { error } = await supabase.from('reservations').delete().eq('id', reservationId);
    if (error) { alert('解除に失敗しました'); return; }
    setRefreshCounter(c => c + 1);
  };

  const handleBulkReceptionClose = async () => {
    if (!selectedShop) return;
    const nowExtended = getNowExtendedTime();
    const cutoffMins = hhmToMinutes(nowExtended);

    const targets = sortedTherapistsWithShift.filter(t =>
      t.id !== 'unassigned' &&
      t.shiftStart && t.shiftEnd &&
      !t.receptionClosedFrom &&
      hhmToMinutes(t.shiftEnd) > cutoffMins &&
      !reservations.some(r =>
        r.therapist_id === t.id &&
        r.status === 'blocked' &&
        toDisplayTime(r.start_time) === t.shiftStart &&
        toDisplayTime(r.end_time) === t.shiftEnd
      )
    );

    if (targets.length === 0) {
      alert('対象のセラピストがいません（すでに受付終了・休み、またはシフト終了済みです）。');
      return;
    }
    if (!confirm(`現在時刻（${nowExtended}）で、${targets.length}名の受付を終了しますか？\n\n対象: ${targets.map(t => t.name).join('、')}`)) return;

    const skipped: string[] = [];
    const inserts: any[] = [];
    targets.forEach(t => {
      const hasConflict = findConfirmedConflicts(t.id, nowExtended).length > 0;
      if (hasConflict) {
        skipped.push(t.name);
        return;
      }
      inserts.push({
        therapist_id: t.id,
        shop_id: selectedShop.id,
        date: filterDate,
        start_time: nowExtended,
        end_time: t.shiftEnd,
        status: 'blocked',
        course_id: null,
        customer_id: null,
        base_price: 0,
        options_price: 0,
        nomination_fee: 0,
        total_price: 0,
        discount_amount: 0,
        designation_type: 'free',
        notes: '受付終了（一括）',
      });
    });

    if (inserts.length > 0) {
      const { error } = await supabase.from('reservations').insert(inserts);
      if (error) { alert('一括受付終了に失敗しました: ' + error.message); return; }
    }

    let msg = `${inserts.length}名を受付終了にしました。`;
    if (skipped.length > 0) msg += `\n\n以下は既存予約と重複するためスキップしました:\n${skipped.join('、')}`;
    alert(msg);
    setRefreshCounter(c => c + 1);
  };

  // 当該店舗・当該日の予約を、お客様連絡／セラピスト連絡ともに一括で「送信済」にする
  const handleBulkMarkNotified = async () => {
    if (!selectedShop) return;

    const targets = reservations.filter(r =>
      r.shop_id === selectedShop.id &&
      r.status === 'confirmed' &&
      (!r.customer_notified || !r.therapist_notified)
    );

    if (targets.length === 0) {
      alert('未送信の予約はありません。');
      return;
    }
    if (!confirm(`${filterDate} の未送信 ${targets.length}件を、お客様・セラピストともに「送信済」にしますか？`)) return;

    const { error } = await supabase
      .from('reservations')
      .update({ customer_notified: true, therapist_notified: true, is_handled: true })
      .in('id', targets.map(r => r.id));

    if (error) { alert('一括送信済みの設定に失敗しました: ' + error.message); return; }

    alert(`${targets.length}件を送信済にしました。`);
    setRefreshCounter(c => c + 1);
  };

  const handleToggleSettlement = async (therapistId: string, date: string, currentlySettled: boolean): Promise<boolean> => {
    if (!selectedShop) return false;
    if (currentlySettled) {
      if (!confirm('未精算に戻しますか？')) return false;
    }

    const { data: existing } = await supabase
      .from('payroll_entries')
      .select('id')
      .eq('shop_id', selectedShop.id)
      .eq('therapist_id', therapistId)
      .eq('business_date', date)
      .maybeSingle();

    const nextStatus = currentlySettled ? 'draft' : 'paid';
    const payload = {
      status: nextStatus,
      confirmed_at: nextStatus === 'paid' ? new Date().toISOString() : null,
      confirmed_by: nextStatus === 'paid' ? (user?.id ?? null) : null,
    };

    const { error } = existing
      ? await supabase.from('payroll_entries').update(payload).eq('id', existing.id)
      : await supabase.from('payroll_entries').insert([{
          shop_id: selectedShop.id,
          therapist_id: therapistId,
          business_date: date,
          ...payload,
        }]);

    if (error) { alert('更新に失敗しました: ' + error.message); return false; }
    setRefreshCounter(c => c + 1);
    return true;
  };

  // クレジット/PayPay の入金確認。カード上の「決済完了」ボタンから呼ばれる
  const handlePaymentSettle = async (reservationId: string, methodLabel: string) => {
    if (!confirm(`この予約を「${methodLabel}決済完了」にしますか？`)) return;
    const { error } = await supabase
      .from('reservations')
      .update({ payment_settled_at: new Date().toISOString() })
      .eq('id', reservationId);
    if (error) { alert('更新に失敗しました: ' + error.message); return; }
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
    if (authLoading || !user) return;
    fetchTherapists();
    fetchShifts();
    fetchReservations();
    fetchPayrollEntries();
  }, [filterDate, selectedShop, refreshCounter, authLoading, user]);

  // 予約のリアルタイム更新（Supabase Realtime）
  useEffect(() => {
    if (!selectedShop || authLoading || !user) return;
    const channel = supabase
      .channel(`shifts-reservations-realtime-${selectedShop.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, (payload) => {
        const row = ((payload.new ?? payload.old) || {}) as Record<string, unknown>;
        if (row.shop_id !== selectedShop.id) return;
        if (row.date !== filterDate) return;
        setRefreshCounter(c => c + 1);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [selectedShop, filterDate, authLoading, user]);

  useEffect(() => {
    if (!selectedShop || authLoading || !user) return;
    supabase
      .from('rooms')
      .select('id, name, order, linked_room_group_id, type, address, memo, google_map_url')
      .eq('shop_id', selectedShop.id)
      .order('order', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        const map = new Map<string, number>();
        (data || []).forEach((r: any, i: number) => map.set(r.id, r.order ?? i));
        setRoomOrderMap(map);
        setRooms((data || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          linked_room_group_id: r.linked_room_group_id,
          type: r.type,
          address: r.address,
          memo: r.memo,
          google_map_url: r.google_map_url
        })));
      });
  }, [selectedShop, refreshCounter, authLoading, user]);

  useEffect(() => {
    if (!selectedShop || authLoading || !user) return;
    const pricingShopId = getPricingShopId(selectedShop);
    supabase
      .from('courses')
      .select('name, duration, base_price, show_on_timechart')
      .eq('shop_id', pricingShopId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        setShopCourses((data as any[])?.map(d => ({ name: d.name, duration: d.duration, price: d.base_price, showOnTimechart: d.show_on_timechart !== false })) || []);
        const timechartDurations = (data || [])
          .filter((c: any) => c.show_on_timechart !== false)
          .map((c: any) => c.duration)
          .filter((d: number) => d > 0);
        const allDurations = (data || []).map((c: any) => c.duration).filter((d: number) => d > 0);
        const durations = timechartDurations.length > 0 ? timechartDurations : allDurations;
        setMinCourseDuration(durations.length > 0 ? Math.min(...durations) : 0);
      });

    supabase
      .from('discount_policies')
      .select('name, discount_value')
      .eq('shop_id', pricingShopId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .then(({ data }) => setShopDiscounts((data as any[])?.map(d => ({ name: d.name, value: d.discount_value })) || []));

    supabase
      .from('designation_types')
      .select('slug, display_name, default_fee')
      .eq('shop_id', pricingShopId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          (data as any[]).forEach((d) => {
            if (d.slug) map[d.slug] = d.display_name;
          });
          setDesignationMap(map);
          setShopDesignations(data.map(d => ({ name: d.display_name, fee: d.default_fee })));
        } else {
          setDesignationMap({});
          setShopDesignations([]);
        }
      });

    supabase
      .from('options')
      .select('name, price, duration_minutes_added, option_type')
      .eq('shop_id', pricingShopId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .then(({ data }) => setShopOptions((data as any[])?.map(d => ({ name: d.name, price: d.price, duration: d.duration_minutes_added, type: d.option_type })) || []));

    supabase
      .from('shops')
      .select('special_rules')
      .eq('id', pricingShopId)
      .single()
      .then(({ data }) => setEffectiveSpecialRules((data as any)?.special_rules || null));
  }, [selectedShop, authLoading, user]);

  const fetchTherapists = async () => {
    if (!selectedShop) return;
    try {
      // 互いに依存しない問い合わせは一度にまとめて投げる。
      // 直列に await すると Supabase までの往復回数だけ待たされ、
      // それがシフト画面の読み込みの遅さの主因になっていた。
      const [groupShopsRes, tsRes, settingsRes, shiftsRes, memosRes] = await Promise.all([
        selectedShop.owner_id
          ? supabase
              .from('shops')
              .select('id')
              .eq('owner_id', selectedShop.owner_id)
          : Promise.resolve({ data: null as { id: string }[] | null }),
        supabase
          .from('therapist_shops')
          .select('therapist_id, alias_name')
          .eq('shop_id', selectedShop.id),
        supabase
          .from('system_settings')
          .select('reservation_interval_minutes, extension_unit_minutes')
          .eq('shop_id', selectedShop.id)
          .limit(1),
        supabase
          .from('shifts')
          .select('therapist_id, room_id, rooms(name, display_name, address, memo, google_map_url), start_time, end_time, notes')
          .eq('shop_id', selectedShop.id)
          .eq('date', filterDate),
        supabase
          .from('therapist_memos')
          .select('id, therapist_id, date, content, amount, resolved_at, resolved_date')
          .eq('shop_id', selectedShop.id)
          .eq('is_resolved', false)
          .order('date', { ascending: false }),
      ]);

      const groupShops = groupShopsRes.data;
      let shopIds = [selectedShop.id];
      if (groupShops && groupShops.length > 0) {
        shopIds = groupShops.map(s => s.id);
      }

      const tsData = tsRes.data;
      const tsTherapistIds = (tsData || []).map(ts => ts.therapist_id);
      const aliasMap = new Map((tsData || []).filter(ts => ts.alias_name).map(ts => [ts.therapist_id, ts.alias_name!]));

      let queryWithInterval = supabase
        .from('therapists')
        .select('id, name, reservation_interval_minutes, age, height, bust, bust_cup, waist, hip, comment, staff_memo, linked_therapist_group_id, therapist_ranks(name), is_rookie');

      if (tsTherapistIds.length > 0) {
        queryWithInterval = queryWithInterval.or(`shop_id.in.(${shopIds.join(',')}),id.in.(${tsTherapistIds.join(',')})`);
      } else {
        queryWithInterval = queryWithInterval.in('shop_id', shopIds);
      }

      let allTherapists: TherapistRow[] = [];
      const { data: therapistsWithInterval, error: therapistsError } = await queryWithInterval.order('name', { ascending: true });

      if (therapistsError) {
        let basicQuery = supabase
          .from('therapists')
          .select('id, name, linked_therapist_group_id, therapist_ranks(name), is_rookie');

        if (tsTherapistIds.length > 0) {
          basicQuery = basicQuery.or(`shop_id.in.(${shopIds.join(',')}),id.in.(${tsTherapistIds.join(',')})`);
        } else {
          basicQuery = basicQuery.in('shop_id', shopIds);
        }

        const { data: basicData } = await basicQuery.order('name', { ascending: true });
        allTherapists = (basicData || []).map(t => ({ ...t, reservation_interval_minutes: null }));
      } else {
        allTherapists = therapistsWithInterval || [];
      }

      // 店舗別源氏名 (alias_name) の優先適用
      allTherapists = allTherapists.map(t => ({
        ...t,
        name: aliasMap.get(t.id) || t.name,
      })).sort((a, b) => a.name.localeCompare(b.name, 'ja', { numeric: true }));

      const settingsData = settingsRes.data;
      const shopInterval = settingsData?.[0]?.reservation_interval_minutes ?? 20;
      setShopIntervalMinutes(shopInterval);
      setExtensionUnitMinutes(settingsData?.[0]?.extension_unit_minutes ?? 30);

      // 連携先店舗名と写真は、どちらもセラピスト一覧が確定すれば投げられるので並列で取得する
      const groupIds = allTherapists.map(t => t.linked_therapist_group_id).filter(Boolean) as string[];
      const therapistIds = allTherapists.map(t => t.id);
      const [linkedRes, photosRes] = await Promise.all([
        groupIds.length > 0
          ? supabase
              .from("therapists")
              .select("linked_therapist_group_id, shops(name)")
              .in("linked_therapist_group_id", groupIds)
              .neq("shop_id", selectedShop.id)
          : Promise.resolve({ data: null as any[] | null }),
        therapistIds.length > 0
          ? supabase
              .from('therapist_photos')
              .select('therapist_id, photo_url, display_order')
              .in('therapist_id', therapistIds)
              .order('display_order', { ascending: true })
          : Promise.resolve({ data: null as any[] | null }),
      ]);

      const linkedMap = new Map<string, string[]>();
      (linkedRes.data || []).forEach((row: any) => {
        const groupId = row.linked_therapist_group_id;
        const shopName = row.shops?.name;
        if (groupId && shopName) {
          const arr = linkedMap.get(groupId) || [];
          if (!arr.includes(shopName)) {
            arr.push(shopName);
          }
          linkedMap.set(groupId, arr);
        }
      });

      const { data: shiftsData, error: shiftsError } = shiftsRes;

      if (shiftsError) {
        console.error('Error fetching shifts:', shiftsError);
        return;
      }

      const shiftsMap = new Map<string, { therapist_id: string; room_id: string | null; start_time: string | null; end_time: string | null; notes?: string | null; rooms: { name: string; display_name?: string | null; address?: string | null; memo?: string | null; google_map_url?: string | null } | null }>();
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
          roomDisplayName: shift?.rooms?.display_name ?? null,
          roomAddress: shift?.rooms?.address ?? null,
          age: therapist.age ?? null,
          height: therapist.height ?? null,
          bust: therapist.bust ?? null,
          bustCup: therapist.bust_cup ?? null,
          waist: therapist.waist ?? null,
          hip: therapist.hip ?? null,
          staffMemo: therapist.staff_memo ?? null,
          intervalMinutes: therapist.reservation_interval_minutes ?? shopInterval,
          notes: shift?.notes ?? null,
          linked_therapist_group_id: therapist.linked_therapist_group_id ?? null,
          linked_shop_names: therapist.linked_therapist_group_id ? (linkedMap.get(therapist.linked_therapist_group_id) || []) : [],
          rankName: Array.isArray(therapist.therapist_ranks)
            ? (therapist.therapist_ranks[0] as any)?.name || null
            : (therapist.therapist_ranks as any)?.name || null,
          isRookie: !!therapist.is_rookie,
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
      const memosData = memosRes.data;

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

      // 先頭写真を avatar にセット（写真は上の Promise.all で取得済み）
      const photoMap = new Map<string, string>()
      for (const p of (photosRes.data || []) as { therapist_id: string; photo_url: string }[]) {
        if (!photoMap.has(p.therapist_id)) photoMap.set(p.therapist_id, p.photo_url)
      }
      setTherapists(withMemos.map(t => ({ ...t, avatar: photoMap.get(t.id) })))
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
      // レースコンディションを避けるため、自店舗のセラピスト・部屋の紐付けグループ情報および店舗連携情報を直接取得
      const [ownTherapistsRes, ownRoomsRes, linksRes, ownShiftsRes] = await Promise.all([
        supabase
          .from('therapists')
          .select('id, linked_therapist_group_id')
          .eq('shop_id', selectedShop.id)
          .eq('is_active', true),
        supabase
          .from('rooms')
          .select('id, linked_room_group_id')
          .eq('shop_id', selectedShop.id),
        supabase
          .from('shop_links')
          .select('shop_id_1, shop_id_2')
          .eq('is_active', true)
          .or(`shop_id_1.eq.${selectedShop.id},shop_id_2.eq.${selectedShop.id}`),
        // 自店舗に本日出勤しているセラピストID一覧（バカラ等、店舗を複製せず
        // 同一セラピスト行がそのまま複数店舗のシフトに登録される運用の判定用）
        supabase
          .from('shifts')
          .select('therapist_id')
          .eq('shop_id', selectedShop.id)
          .eq('date', filterDate)
      ]);
      const ownTherapists = ownTherapistsRes.data || [];
      const ownRooms = ownRoomsRes.data || [];
      const linkedShopIds = (linksRes.data || []).map((l: any) => l.shop_id_1 === selectedShop.id ? l.shop_id_2 : l.shop_id_1);
      const ownShiftTherapistIds = new Set((ownShiftsRes.data || []).map((s: any) => s.therapist_id).filter(Boolean));

      // 自店舗に出勤中のセラピストが、同日に他店舗のシフトにも入っている場合、
      // その店舗も予約取得の対象に含める（同一セラピスト行を複数店舗で共有する運用向け）
      let crossShopIdsForSharedTherapists: string[] = [];
      if (ownShiftTherapistIds.size > 0) {
        const { data: otherShiftsData } = await supabase
          .from('shifts')
          .select('shop_id, therapist_id')
          .in('therapist_id', Array.from(ownShiftTherapistIds))
          .eq('date', filterDate)
          .neq('shop_id', selectedShop.id);
        crossShopIdsForSharedTherapists = Array.from(
          new Set((otherShiftsData || []).map((s: any) => s.shop_id).filter(Boolean))
        );
      }

      const targetShopIds = Array.from(
        new Set([selectedShop.id, ...linkedShopIds, ...crossShopIdsForSharedTherapists])
      );

      // 連携店舗に限定して該当日の予約を取得
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
          is_handled,
          source,
          payment_method,
          customer_notified,
          therapist_notified,
          extension_count,
          shop_id,
          room_id,
          customer_type_override,
          reception_source,
          booking_method,
          options_payment_method,
          extension_payment_method,
          payment_settled_at,
          customers(name, created_at),
          courses(name, duration),
          therapist:therapists!reservations_therapist_id_fkey(name, linked_therapist_group_id),
          room:rooms!reservations_room_id_fkey(name, linked_room_group_id),
          shop:shops!reservations_shop_id_fkey(name, short_name)
        `)
        .in('shop_id', targetShopIds)
        .or(`business_date.eq.${filterDate},and(business_date.is.null,date.eq.${filterDate})`)
        .in('status', ['confirmed', 'blocked', 'pending']);

      if (error) throw error;

      const allRes = (data || []) as any[];

      // 過去に予約がある顧客を特定する処理を追加
      const customerIds = Array.from(new Set(allRes.map((r) => r.customer_id).filter(Boolean)));
      const pastCustomerIds = new Set<string>();
      if (customerIds.length > 0) {
        const { data: pastRes } = await supabase
          .from('reservations')
          .select('customer_id')
          .in('customer_id', customerIds)
          .eq('shop_id', selectedShop.id)
          .lt('date', filterDate)
          .in('status', ['confirmed', 'blocked', 'pending']);
        if (pastRes) {
          pastRes.forEach((r: any) => pastCustomerIds.add(r.customer_id));
        }
      }

      const processed: any[] = [];

      allRes.forEach((res) => {
        if (res.shop_id === selectedShop.id) {
          // 自店舗の予約はそのまま追加
          const isNew = res.customer_type_override
            ? res.customer_type_override === 'new'
            : !pastCustomerIds.has(res.customer_id)

          processed.push({
            ...res,
            isNewCustomer: isNew
          });
        } else {
          // 他店舗の予約：リンクされているものがあるか判定
          let isLinked = false;
          let mappedTherapistId = res.therapist_id;
          let mappedRoomId = res.room_id;

          // セラピストの紐付け（店舗ごとに複製された別行を linked_therapist_group_id で対応付ける運用）
          if (res.therapist?.linked_therapist_group_id) {
            const targetTherapist = ownTherapists.find((t: any) => t.linked_therapist_group_id === res.therapist.linked_therapist_group_id);
            if (targetTherapist) {
              mappedTherapistId = targetTherapist.id;
              isLinked = true;
            }
          }

          // セラピスト行を複製せず、同一IDのまま複数店舗のシフトに入る運用
          // （バカラ等）：自店舗に本日出勤中の同じセラピストIDなら、IDの
          // 付け替えなしでそのままブロック対象にする。
          // confirmed（実際の予約）に加えて blocked（受付不可設定）も対象にする。
          // 同一人物が他店舗のシフトにも入っている場合に限定しているため、
          // 無関係な店舗への波及は起きない。
          if (!isLinked && res.therapist_id && (res.status === 'confirmed' || res.status === 'blocked') && ownShiftTherapistIds.has(res.therapist_id)) {
            isLinked = true;
          }

          // ルーム（部屋）の紐付け
          if (res.room?.linked_room_group_id) {
            const targetRoom = ownRooms.find((r: any) => r.linked_room_group_id === res.room.linked_room_group_id);
            if (targetRoom) {
              mappedRoomId = targetRoom.id;
              isLinked = true;
            }
          }

          if (isLinked) {
            // 他店舗で予約が入っている時間を自店舗のスケジュール上でブロックする
            const otherShopName = res.shop?.short_name || res.shop?.name || '他店舗';
            processed.push({
              ...res,
              therapist_id: mappedTherapistId,
              room_id: mappedRoomId,
              status: 'blocked', // スケジュール上で「予約不可（ブロック）」として描画させる
              customers: {
                name: `${otherShopName}予約`,
                created_at: null
              },
              courses: null,
              notes: null,
            });
          }
        }
      });

      setReservations(processed);
    } catch (error) {
      console.error('予約の取得に失敗:', error);
    }
  };

  const fetchPayrollEntries = async () => {
    if (!selectedShop) return;
    try {
      const { data, error } = await supabase
        .from('payroll_entries')
        .select('therapist_id, status, confirmed_at')
        .eq('shop_id', selectedShop.id)
        .eq('business_date', filterDate);
      if (error) throw error;
      const map = new Map<string, { status: string; confirmed_at: string | null }>();
      (data || []).forEach((row: any) => {
        map.set(row.therapist_id, { status: row.status, confirmed_at: row.confirmed_at });
      });
      setPayrollEntries(map);
    } catch (error) {
      console.error('精算状況の取得に失敗:', error);
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

  const designationLabel = (v: string) => {
    if (designationMap && designationMap[v]) return designationMap[v];
    return ({ free: 'フリー', first_nomination: '初回指名', nomination: '指名', confirmed: '本指名', princess: '姫予約' }[v] || v);
  };

  // タイムチャートの空き時間候補に使うコース（「タイムチャートに表示」がOFFのコースを除外。全件OFFの場合は空き表示自体が消えないよう全コースにフォールバック）
  const timechartCourses = shopCourses.some(c => c.showOnTimechart)
    ? shopCourses.filter(c => c.showOnTimechart)
    : shopCourses;

  const getAvailableCourses = (startMin: number, endMin: number): AvailableCourse[] => {
    const totalAvail = endMin - startMin;
    if (totalAvail <= 0) return [];

    const menuDurations = timechartCourses && timechartCourses.length > 0
      ? Array.from(new Set(timechartCourses.map(c => c.duration))).sort((a, b) => a - b)
      : [30, 45, 60, 90, 120, 150, 180];

    const filtered = menuDurations.filter(d => d <= totalAvail);
    if (filtered.length === 0) return [];

    const formatMinToHHMM = (m: number) => {
      const h = Math.floor(m / 60);
      const min = m % 60;
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    };

    const getCourseColors = (duration: number) => {
      if (duration >= 150) {
        return {
          bg: '#fbcfe8', // pink-200
          border: '#ec4899', // pink-500
          text: '#831843', // pink-900
        };
      } else if (duration >= 120) {
        return {
          bg: '#e9d5ff', // purple-200
          border: '#a855f7', // purple-500
          text: '#581c87', // purple-900
        };
      } else if (duration >= 90) {
        return {
          bg: '#bae6fd', // sky-200
          border: '#0ea5e9', // sky-500
          text: '#0c4a6e', // sky-900
        };
      } else if (duration >= 60) {
        return {
          bg: '#a7f3d0', // emerald-200
          border: '#10b981', // emerald-500
          text: '#064e3b', // emerald-900
        };
      } else {
        return {
          bg: '#fef08a', // yellow-200
          border: '#eab308', // yellow-500
          text: '#713f12', // yellow-900
        };
      }
    };

    // 表示用コースを選択（短い順に最大4本）
    const selectedDurations = filtered.slice(0, 4);

    const sorted = [...selectedDurations].sort((a, b) => b - a);

    return sorted.map(d => {
      const latestStartMin = endMin - d;
      const latestStartStr = formatMinToHHMM(latestStartMin);
      const colors = getCourseColors(d);
      return {
        duration: d,
        startTime: latestStartStr,
        endTime: formatMinToHHMM(endMin),
        latestStartTime: latestStartStr,
        color: colors.bg,
        borderColor: colors.border,
        textColor: colors.text,
        label: `${latestStartStr} ${d}分`,
      };
    });
  };

  const getAvailableText = (startMin: number, endMin: number) => {
    const totalAvail = endMin - startMin;
    if (totalAvail <= 0) return '';

    const menuDurations = timechartCourses && timechartCourses.length > 0
      ? Array.from(new Set(timechartCourses.map(c => c.duration))).sort((a, b) => a - b)
      : [30, 45, 60, 90, 120, 150, 180];

    const filtered = menuDurations.filter(d => d <= totalAvail);
    if (filtered.length === 0) {
      return `空き ${totalAvail}分`;
    }

    const formatMinToHHMM = (m: number) => {
      const h = Math.floor(m / 60);
      const min = m % 60;
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    };

    const sortedFiltered = [...filtered].sort((a, b) => b - a);
    return sortedFiltered
      .map(d => `${d}分 (最終案内 ${formatMinToHHMM(endMin - d)})`)
      .join('\n');
  };

  const schedules: Schedule[] = [
    ...reservations
      .filter((r: any) => r.status !== 'blocked')
      .map((reservation) => ({
        therapistId: reservation.therapist_id || 'unassigned',
        startTime: toDisplayTime(reservation.start_time),
        endTime: toDisplayTime(reservation.end_time),
        title: `${reservation.customers?.name || 'unknown'}`,
        type: 'reservation' as const,
        reservationId: reservation.id,
        customerId: reservation.customer_id,
        customerName: reservation.customers?.name,
        courseDuration: reservation.courses?.duration,
        designationLabel: designationLabel(reservation.designation_type),
        totalPrice: reservation.total_price,
        discountAmount: reservation.discount_amount > 0 ? reservation.discount_amount : undefined,
        isNewCustomer: reservation.isNewCustomer,
        isHime: reservation.designation_type === 'princess',
        isPending: reservation.status === 'pending',
        isHandled: reservation.is_handled,
        source: reservation.source,
        receptionSource: reservation.reception_source,
        bookingMethod: reservation.booking_method,
        paymentMethod: reservation.payment_method,
        optionsPaymentMethod: reservation.options_payment_method,
        extensionPaymentMethod: reservation.extension_payment_method,
        paymentSettledAt: reservation.payment_settled_at,
        customerNotified: reservation.customer_notified,
        therapistNotified: reservation.therapist_notified,
        extensionMinutes: (reservation.extension_count || 0) * extensionUnitMinutes,
      })),
    ...reservations
      .filter((r: any) => r.status === 'blocked')
      .map((reservation) => ({
        therapistId: reservation.therapist_id || 'unassigned',
        startTime: toDisplayTime(reservation.start_time),
        endTime: toDisplayTime(reservation.end_time),
        title: reservation.customers?.name || '予約不可',
        customerName: reservation.customers?.name || undefined,
        type: 'blocked' as const,
        reservationId: reservation.id,
        notes: reservation.notes || undefined,
        isOtherShop: reservation.shop_id !== selectedShop?.id,
      })),
    ...(() => {
      const intervalSchedules: Schedule[] = [];
      
      therapists.forEach((therapist) => {
        const interval = therapist.intervalMinutes != null
          ? therapist.intervalMinutes
          : shopIntervalMinutes;
        if (interval <= 0) return;

        let shiftStartMin: number | undefined;
        let shiftEndAdjusted: number | undefined;
        if (therapist.shiftStart) {
          shiftStartMin = hhmToMinutes(therapist.shiftStart);
          if (therapist.shiftEnd) {
            let shiftEndMin = hhmToMinutes(therapist.shiftEnd);
            if (shiftEndMin <= shiftStartMin) shiftEndMin += 24 * 60;
            shiftEndAdjusted = shiftEndMin;
          }
        }

        // シフト範囲が定義されていない（非出勤）の場合はスキップ
        if (shiftStartMin === undefined || shiftEndAdjusted === undefined) return;

        // 予約とブロックの両方を「境界（boundaries）」として抽出
        const boundaries = reservations
          .filter((r: any) => r.therapist_id === therapist.id)
          .map((r: any) => {
            const startMin = hhmToMinutes(toDisplayTime(r.start_time));
            let endMin = hhmToMinutes(toDisplayTime(r.end_time));
            if (endMin <= startMin) endMin += 24 * 60;
            return {
              startMin,
              endMin,
              startTimeStr: toDisplayTime(r.start_time),
              endTimeStr: toDisplayTime(r.end_time),
              type: (r.status === 'blocked' && r.shop_id === selectedShop?.id) ? ('blocked' as const) : ('reservation' as const),
            };
          })
          .sort((a, b) => a.startMin - b.startMin);

        // 1. シフト開始から最初の境界までの Gap
        const firstBound = boundaries[0];
        const firstLimit = firstBound ? firstBound.startMin : shiftEndAdjusted;
        
        // 最初の予定が確定予約(reservation)の場合のみ事前インターバルが必要
        const needPreInterval = firstBound && firstBound.type === 'reservation';
        const firstPreStart = needPreInterval 
          ? Math.max(shiftStartMin, firstLimit - interval)
          : firstLimit;

        if (needPreInterval && firstPreStart < firstLimit) {
          intervalSchedules.push({
            therapistId: therapist.id,
            startTime: minutesToHHMM(firstPreStart),
            endTime: firstBound.startTimeStr,
            title: `インターバル ${interval}分`,
            type: 'interval' as const,
          });
        }
        if (shiftStartMin < firstPreStart) {
          const totalAvail = firstPreStart - shiftStartMin;
          const menuDurations = timechartCourses && timechartCourses.length > 0
            ? Array.from(new Set(timechartCourses.map(c => c.duration))).sort((a, b) => a - b)
            : [30, 45, 60, 90, 120, 150, 180];
          const filtered = menuDurations.filter(d => d <= totalAvail);
          const isAvail = filtered.length > 0;

          intervalSchedules.push({
            therapistId: therapist.id,
            startTime: minutesToHHMM(shiftStartMin),
            endTime: minutesToHHMM(firstPreStart),
            title: isAvail ? getAvailableText(shiftStartMin, firstPreStart) : `不足\n${totalAvail}分`,
            type: (isAvail ? 'available' : 'unavailable') as any,
            availableCourses: isAvail ? getAvailableCourses(shiftStartMin, firstPreStart) : undefined,
          });
        }

        // 2. 境界間の Gap
        for (let i = 0; i < boundaries.length - 1; i++) {
          const cur = boundaries[i];
          const next = boundaries[i + 1];
          
          const curInterval = cur.type === 'reservation' ? interval : 0;
          const nextInterval = next.type === 'reservation' ? interval : 0;
          
          const gap = next.startMin - cur.endMin;
          if (gap <= 0) continue;

          const totalInterval = curInterval + nextInterval;

          if (gap <= totalInterval) {
            if (gap > 0) {
              intervalSchedules.push({
                therapistId: therapist.id,
                startTime: minutesToHHMM(cur.endMin),
                endTime: minutesToHHMM(next.startMin),
                title: `インターバル ${gap}分`,
                type: 'interval' as const,
              });
            }
          } else {
            if (curInterval > 0) {
              intervalSchedules.push({
                therapistId: therapist.id,
                startTime: minutesToHHMM(cur.endMin),
                endTime: minutesToHHMM(cur.endMin + curInterval),
                title: `インターバル ${curInterval}分`,
                type: 'interval' as const,
              });
            }
            if (nextInterval > 0) {
              intervalSchedules.push({
                therapistId: therapist.id,
                startTime: minutesToHHMM(next.startMin - nextInterval),
                endTime: minutesToHHMM(next.startMin),
                title: `インターバル ${nextInterval}分`,
                type: 'interval' as const,
              });
            }

            const availStart = cur.endMin + curInterval;
            const availEnd = next.startMin - nextInterval;
            if (availStart < availEnd) {
              const totalAvail = availEnd - availStart;
              const menuDurations = timechartCourses && timechartCourses.length > 0
                ? Array.from(new Set(timechartCourses.map(c => c.duration))).sort((a, b) => a - b)
                : [30, 45, 60, 90, 120, 150, 180];
              const filtered = menuDurations.filter(d => d <= totalAvail);
              const isAvail = filtered.length > 0;

              intervalSchedules.push({
                therapistId: therapist.id,
                startTime: minutesToHHMM(availStart),
                endTime: minutesToHHMM(availEnd),
                title: isAvail ? getAvailableText(availStart, availEnd) : `不足\n${totalAvail}分`,
                type: (isAvail ? 'available' : 'unavailable') as any,
                availableCourses: isAvail ? getAvailableCourses(availStart, availEnd) : undefined,
              });
            }
          }
        }

        // 3. 最後の境界からシフト終了までの Gap
        if (boundaries.length > 0) {
          const lastBound = boundaries[boundaries.length - 1];
          const needPostInterval = lastBound.type === 'reservation';
          let lastPostEnd = needPostInterval ? lastBound.endMin + interval : lastBound.endMin;
          if (shiftEndAdjusted !== undefined) {
            lastPostEnd = Math.min(shiftEndAdjusted, lastPostEnd);
          }

          if (needPostInterval && lastBound.endMin < lastPostEnd) {
            intervalSchedules.push({
              therapistId: therapist.id,
              startTime: lastBound.endTimeStr,
              endTime: minutesToHHMM(lastPostEnd),
              title: `インターバル ${interval}分`,
              type: 'interval' as const,
            });
          }

          if (lastPostEnd < shiftEndAdjusted) {
            const totalAvail = shiftEndAdjusted - lastPostEnd;
            const menuDurations = timechartCourses && timechartCourses.length > 0
              ? Array.from(new Set(timechartCourses.map(c => c.duration))).sort((a, b) => a - b)
              : [30, 45, 60, 90, 120, 150, 180];
            const filtered = menuDurations.filter(d => d <= totalAvail);
            const isAvail = filtered.length > 0;

            intervalSchedules.push({
              therapistId: therapist.id,
              startTime: minutesToHHMM(lastPostEnd),
              endTime: minutesToHHMM(shiftEndAdjusted),
              title: isAvail ? getAvailableText(lastPostEnd, shiftEndAdjusted) : `不足\n${totalAvail}分`,
              type: (isAvail ? 'available' : 'unavailable') as any,
              availableCourses: isAvail ? getAvailableCourses(lastPostEnd, shiftEndAdjusted) : undefined,
            });
          }
        }
      });

      return intervalSchedules;
    })(),
  ];

  const sortedTherapistsWithShift = useMemo(() => {
    // 休み（シフト全時間帯がblocked）のメモを優先してnotesをマージ
    // ※部分的な予約不可スロットのメモはブロック側に表示するため、ここでは拾わない
    const withShift = therapists.filter(t => t.shiftStart && t.shiftEnd).map(t => {
      const blockedNote = reservations.find(r =>
        r.therapist_id === t.id &&
        r.status === 'blocked' &&
        toDisplayTime(r.start_time) === t.shiftStart &&
        toDisplayTime(r.end_time) === t.shiftEnd
      )?.notes;

      // 受付終了: シフト全体を覆う「休み」ブロックとは別に、notesが「受付終了」で始まる部分ブロックを検出する
      const receptionCloseRes = reservations.find(r =>
        r.therapist_id === t.id &&
        r.status === 'blocked' &&
        r.notes?.startsWith('受付終了') &&
        !(toDisplayTime(r.start_time) === t.shiftStart && toDisplayTime(r.end_time) === t.shiftEnd)
      );

      const settlement = payrollEntries.get(t.id);

      return {
        ...t,
        ...(blockedNote != null ? { notes: blockedNote } : {}),
        receptionClosedFrom: receptionCloseRes ? toDisplayTime(receptionCloseRes.start_time) : null,
        receptionClosedReservationId: receptionCloseRes ? receptionCloseRes.id : null,
        isSettled: settlement?.status === 'paid',
      };
    });

    // 休み（全日受付不可）= シフト全時間帯と一致するblockedスロットを持つ
    const isOff = (t: Therapist) => {
      if (!t.shiftStart || !t.shiftEnd) return false;
      return reservations.some(r =>
        r.status === 'blocked' &&
        r.therapist_id === t.id &&
        toDisplayTime(r.start_time) === t.shiftStart &&
        toDisplayTime(r.end_time) === t.shiftEnd
      );
    };

    const unassignedTherapist: Therapist = {
      id: 'unassigned',
      name: 'フリー（未割当）',
      intervalMinutes: shopIntervalMinutes,
      notes: '未割当のフリー予約枠',
    };

    let sortedOthers = [...withShift];

    if (sortMode === 'shift') {
      sortedOthers.sort((a, b) => {
        if (isOff(a) !== isOff(b)) return isOff(a) ? 1 : -1;
        return hhmToMinutes(a.shiftStart || '99:99') - hhmToMinutes(b.shiftStart || '99:99');
      });
    } else if (sortMode === 'room') {
      sortedOthers.sort((a, b) => {
        if (isOff(a) !== isOff(b)) return isOff(a) ? 1 : -1;
        const aOrder = a.roomId ? (roomOrderMap.get(a.roomId) ?? 9999) : 9999;
        const bOrder = b.roomId ? (roomOrderMap.get(b.roomId) ?? 9999) : 9999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return hhmToMinutes(a.shiftStart || '99:99') - hhmToMinutes(b.shiftStart || '99:99');
      });
    } else if (sortMode === 'reservation') {
      const now = new Date();
      let currentMins = now.getHours() * 60 + now.getMinutes();
      if (now.getHours() < 6) currentMins += 24 * 60;

      const getShiftEndMins = (t: Therapist): number => {
        let endMins = hhmToMinutes(t.shiftEnd!);
        const startMins = hhmToMinutes(t.shiftStart || '00:00');
        if (endMins <= startMins) endMins += 24 * 60;
        return endMins;
      };

      const getNextAvailableMins = (t: Therapist): { mins: number; finished: boolean } => {
        if (!t.shiftStart || !t.shiftEnd) return { mins: 9999, finished: true };
        const shiftStartMins = hhmToMinutes(t.shiftStart);
        const shiftEndMins = getShiftEndMins(t);

        if (currentMins >= shiftEndMins) {
          return { mins: 9999, finished: true };
        }

        const interval = t.intervalMinutes ?? shopIntervalMinutes;
        let slots: [number, number][] = [[Math.max(currentMins, shiftStartMins), shiftEndMins]];

        const therapistRes = reservations.filter(
          (r: any) => r.therapist_id === t.id && (r.status === 'confirmed' || r.status === 'blocked')
        );

        therapistRes.forEach((r: any) => {
          const resStart = hhmToMinutes(toDisplayTime(r.start_time));
          let resEnd = hhmToMinutes(toDisplayTime(r.end_time));
          if (resEnd <= resStart) resEnd += 24 * 60;

          let blockStart = resStart;
          let blockEnd = resEnd;

          if (r.status === 'confirmed' || r.shop_id !== selectedShop?.id) {
            blockStart = Math.max(shiftStartMins, resStart - interval);
            blockEnd = resEnd + interval;
          }

          const nextSlots: [number, number][] = [];
          slots.forEach(([sStart, sEnd]) => {
            if (blockStart >= sEnd || blockEnd <= sStart) {
              nextSlots.push([sStart, sEnd]);
            } else {
              if (sStart < blockStart) {
                nextSlots.push([sStart, blockStart]);
              }
              if (blockEnd < sEnd) {
                nextSlots.push([blockEnd, sEnd]);
              }
            }
          });
          slots = nextSlots;
        });

        const requiredMins = minCourseDuration > 0 ? minCourseDuration : 1;
        const validSlot = slots.find(([sStart, sEnd]) => sEnd - sStart >= requiredMins);

        if (validSlot) {
          return { mins: validSlot[0], finished: false };
        } else {
          return { mins: 9999, finished: true };
        }
      };

      const availabilityMap = new Map<string, { mins: number; finished: boolean }>();
      sortedOthers.forEach(t => {
        availabilityMap.set(t.id, getNextAvailableMins(t));
      });

      sortedOthers.sort((a, b) => {
        if (isOff(a) !== isOff(b)) return isOff(a) ? 1 : -1;
        const aAvail = availabilityMap.get(a.id)!;
        const bAvail = availabilityMap.get(b.id)!;

        if (aAvail.finished !== bAvail.finished) {
          return aAvail.finished ? 1 : -1;
        }
        if (aAvail.mins !== bAvail.mins) {
          return aAvail.mins - bAvail.mins;
        }
        return hhmToMinutes(a.shiftStart || '99:99') - hhmToMinutes(b.shiftStart || '99:99');
      });
    }
    return [unassignedTherapist, ...sortedOthers];
  }, [therapists, sortMode, roomOrderMap, reservations, shopIntervalMinutes, minCourseDuration, selectedShop, payrollEntries]);

  // 週間表示用：全セラピストを詳細な形式にマップ
  const therapistsForWeekly = therapists.map(t => ({
    id: t.id,
    name: t.name,
    avatar: t.avatar,
    reservation_interval_minutes: t.intervalMinutes ?? null,
    age: t.age,
    height: t.height,
    bust: t.bust,
    bustCup: t.bustCup,
    waist: t.waist,
    hip: t.hip,
    staffMemo: t.staffMemo,
    unresolvedMemos: t.unresolvedMemos,
    linked_therapist_group_id: t.linked_therapist_group_id ?? null,
    linked_shop_names: t.linked_shop_names || [],
    rankName: t.rankName,
    isRookie: t.isRookie,
  }));

  return (
    <div className="bg-gray-100 p-2 md:p-4">
      <div className="w-full mx-auto">
        <div className="mb-2 md:mb-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5">



          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight whitespace-nowrap">
                スケジュール
              </h1>
              <span className="text-xs text-slate-400 font-semibold md:hidden whitespace-nowrap">
                ({viewMode === 'day' ? 'タイムチャート横' : viewMode === 'vertical' ? 'タイムチャート縦' : '週間'})
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* 店舗ルールツールチップ */}
              <div 
                ref={rulesRef}
                className="relative group cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTooltip(prev => prev === 'rules' ? null : 'rules');
                }}
              >
                <span className="flex items-center gap-1 px-2.5 py-1 md:px-3.5 md:py-1.5 rounded-full bg-white hover:bg-slate-50 transition-all shadow-sm border border-slate-200 text-xs md:text-sm font-bold whitespace-nowrap">
                  <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-slate-700">店舗ルール</span>
                  <span className="text-slate-300 px-0.5">/</span>
                  <span className="text-blue-600">料金システム</span>
                </span>
                {/* ツールチップの内容 */}
                <div 
                  className={`absolute left-0 top-full mt-2 w-80 p-4 bg-white border border-slate-200 shadow-xl rounded-xl transition-all z-50 text-sm max-h-[80vh] overflow-y-auto ${
                    activeTooltip === 'rules' ? 'opacity-100 visible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1">{selectedShop?.name} 店舗ルール</h3>
                  
                  {/* 特殊ルール・注意事項 */}
                  {effectiveSpecialRules && (
                    <div className="mb-4">
                      <h4 className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1.5 rounded-md mb-2 flex items-center gap-1.5">
                        <span className="text-amber-500">💡</span> 特殊ルール・注意事項
                      </h4>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 shadow-sm">
                        {effectiveSpecialRules}
                      </p>
                    </div>
                  )}

                  {/* コース料金 */}
                  <div className="mb-4">
                    <h4 className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1.5 rounded-md mb-2 flex items-center gap-1.5">
                      <span className="text-blue-500">🕒</span> 料金システム（コース）
                    </h4>
                    {shopCourses.length > 0 ? (
                      <ul className="text-xs space-y-1">
                        {shopCourses.map((c, i) => (
                          <li key={i} className="flex justify-between border-b border-slate-50 pb-1 last:border-0">
                            <span className="text-slate-700">{c.name} ({c.duration}分)</span>
                            <span className="font-bold text-slate-800">¥{c.price.toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-400">コースが設定されていません</p>
                    )}
                  </div>

                  {/* 指名料金 */}
                  <div className="mb-4">
                    <h4 className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1.5 rounded-md mb-2 flex items-center gap-1.5">
                      <span className="text-indigo-500">👑</span> 指名料金
                    </h4>
                    {shopDesignations.length > 0 ? (
                      <ul className="text-xs space-y-1">
                        {shopDesignations.map((d, i) => (
                          <li key={i} className="flex justify-between border-b border-slate-50 pb-1 last:border-0">
                            <span className="text-slate-700">{d.name}</span>
                            <span className="font-bold text-slate-800">
                              {d.fee > 0 ? `¥${d.fee.toLocaleString()}` : '無料'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-400">指名料金が設定されていません</p>
                    )}
                  </div>

                  {/* 割引 */}
                  <div className="mb-4">
                    <h4 className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-1.5 rounded-md mb-2 flex items-center gap-1.5">
                      <span className="text-rose-500">🏷️</span> 割引ルール
                    </h4>
                    {shopDiscounts.length > 0 ? (
                      <ul className="text-xs space-y-1">
                        {shopDiscounts.map((d, i) => (
                          <li key={i} className="flex justify-between border-b border-slate-50 pb-1 last:border-0">
                            <span className="text-slate-700">{d.name}</span>
                            <span className="font-bold text-rose-600">-¥{d.value.toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-400">割引が設定されていません</p>
                    )}
                  </div>

                  {/* オプション */}
                  <div>
                    <h4 className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1.5 rounded-md mb-2 flex items-center gap-1.5">
                      <span className="text-emerald-500">✨</span> オプション
                    </h4>
                    {shopOptions.length > 0 ? (
                      <ul className="text-xs space-y-1">
                        {shopOptions.map((o, i) => (
                          <li key={i} className="flex flex-col border-b border-slate-50 pb-1 last:border-0">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-700">{o.name}</span>
                              <span className="font-bold text-slate-800">¥{o.price.toLocaleString()}</span>
                            </div>
                            {o.duration > 0 && (
                              <div className="text-[10px] text-slate-400 text-right mt-0.5">追加時間: +{o.duration}分</div>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-400">オプションが設定されていません</p>
                    )}
                  </div>
                </div>
              </div>
              {selectedShop?.is_dispatch_enabled && (
                <div 
                  ref={hotelsRef}
                  className="relative group cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTooltip(prev => prev === 'hotels' ? null : 'hotels');
                  }}
                >
                  <span className="flex items-center gap-1 px-2.5 py-1 md:px-3.5 md:py-1.5 rounded-full bg-white hover:bg-slate-50 transition-all shadow-sm border border-slate-200 text-xs md:text-sm font-bold whitespace-nowrap">
                    <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-violet-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span className="text-violet-600">ホテル一覧</span>
                  </span>
                  
                  {/* ホテル一覧のツールチップ内容 */}
                  <div 
                    className={`absolute left-0 top-full mt-2 w-[26rem] p-4 bg-white border border-slate-200 shadow-xl rounded-xl transition-all z-50 text-sm max-h-[80vh] overflow-y-auto font-normal tracking-normal text-slate-700 ${
                      activeTooltip === 'hotels' ? 'opacity-100 visible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-1 flex justify-between items-center">
                      <span>🏨 登録ホテル一覧</span>
                      <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded font-black">
                        {rooms.filter(r => r.type === 'hotel').length}軒
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {rooms.filter(r => r.type === 'hotel').length > 0 ? (
                        rooms.filter(r => r.type === 'hotel').map((h, i) => (
                          <div key={i} className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <div className="flex justify-between items-center mb-1 gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-bold text-slate-800 whitespace-nowrap">{h.name}</span>
                                {h.google_map_url && (
                                  <a
                                    href={h.google_map_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-slate-400 hover:text-blue-600 transition-colors text-sm flex-shrink-0"
                                    title="地図アプリで確認"
                                  >
                                    🗺️
                                  </a>
                                )}
                              </div>
                              {h.memo && (
                                <span className="text-[9px] bg-rose-50 border border-rose-100 text-rose-600 px-1.5 py-0.5 rounded font-bold whitespace-nowrap flex-shrink-0">
                                  {h.memo}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 break-all leading-normal">{h.address}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 italic py-2 text-center">登録されているホテルはありません。</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5 hidden md:block whitespace-nowrap">
            {viewMode === 'day' ? 'タイムチャート横表示' : viewMode === 'vertical' ? 'タイムチャート縦表示' : '週間表示'}
          </p>
        </div>

        {/* フィルターと表示切り替え */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 md:p-4 mb-2 md:mb-3">
          <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2">
            {/* ビュー切り替えトグル */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg gap-1">
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${viewMode === 'day'
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                タイムチャート（横）
              </button>
              <button
                onClick={() => setViewMode('vertical')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${viewMode === 'vertical'
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                タイムチャート（縦）
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${viewMode === 'week'
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                週間表示
              </button>
            </div>

            {/* 並び替えモード */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {([
                { key: 'shift', label: '出勤時間順' },
                { key: 'room', label: 'ルーム順' },
                { key: 'reservation', label: '受付時間順' },
              ] as { key: SortMode; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSortMode(key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${sortMode === key
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 日付ナビゲーション */}
            <div className="flex gap-1 items-center bg-slate-100 p-1 rounded-lg">
              {viewMode === 'day' || viewMode === 'vertical' ? (
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
                    className="w-auto px-2 h-[30px] bg-white border border-slate-200 text-slate-700 font-bold rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm text-xs"
                  />
                  <button
                    onClick={handleNextDay}
                    className="px-2 py-1.5 bg-white text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md text-xs font-bold shadow-sm border border-slate-200 transition-colors whitespace-nowrap"
                  >
                    翌日 →
                  </button>
                  <button
                    onClick={() => setFilterDate(getBusinessDateStr())}
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
                      return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} 〜 ${String(end.getMonth() + 1).padStart(2, '0')}/${String(end.getDate()).padStart(2, '0')}`;
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

            {/* 一括送信済み（お客様・セラピストまとめて） */}
            {(viewMode === 'day' || viewMode === 'vertical') && (
              <button
                onClick={handleBulkMarkNotified}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 shadow-sm transition-colors font-bold text-xs whitespace-nowrap"
                title="この日の未送信の予約を、お客様連絡・セラピスト連絡ともに送信済にします"
              >
                全員 送信済
              </button>
            )}

            {/* 一括受付終了（当日のみ） */}
            {(viewMode === 'day' || viewMode === 'vertical') && filterDate === getBusinessDateStr() && (
              <button
                onClick={handleBulkReceptionClose}
                className="px-3 py-1.5 bg-amber-500 text-white rounded-md hover:bg-amber-600 shadow-sm transition-colors font-bold text-xs whitespace-nowrap"
                title="現在時刻を締切として、対象セラピスト全員の受付を終了します"
              >
                全員 受付終了
              </button>
            )}

          </div>
        </div>

        {/* タイムチャートビュー */}
        {viewMode === 'day' && (() => {
          return (
            <div className="bg-white rounded-lg shadow-lg overflow-visible relative">
              {loading && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-lg">
                  <p className="text-gray-600 font-semibold animate-pulse">読み込み中...</p>
                </div>
              )}
              <div ref={chartContainerRef} style={{ height: `${chartHeight}px` }} className="w-full">
                {sortedTherapistsWithShift.length > 0 ? (
                  <TimeChart
                    therapists={sortedTherapistsWithShift}
                    schedules={schedules}
                    date={filterDate}
                    scrollToTime={searchParams.get('scroll_to_time')}
                    onBlockedClick={(id, startTime, endTime) =>
                      setBlockedModal({ id, startTime, endTime, memo: reservations.find(r => r.id === id)?.notes ?? '' })
                    }
                    onShiftEditOpen={handleOpenShiftEdit}
                    onReceptionCloseOpen={handleOpenReceptionClose}
                    onReceptionCloseClear={handleClearReceptionClosed}
                    onSettlementToggle={handleToggleSettlement}
                    onPaymentSettle={handlePaymentSettle}
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

        {/* タイムチャート縦（バーティカル）ビュー */}
        {viewMode === 'vertical' && (() => {
          return (
            <div className="bg-white rounded-lg shadow-lg overflow-visible relative">
              {loading && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-lg">
                  <p className="text-gray-600 font-semibold animate-pulse">読み込み中...</p>
                </div>
              )}
              <div ref={chartContainerRef} style={{ height: `${chartHeight}px` }} className="w-full">
                {sortedTherapistsWithShift.length > 0 ? (
                  <VerticalTimeChart
                    therapists={sortedTherapistsWithShift}
                    schedules={schedules}
                    date={filterDate}
                    scrollToTime={searchParams.get('scroll_to_time')}
                    onBlockedClick={(id, startTime, endTime) =>
                      setBlockedModal({ id, startTime, endTime, memo: reservations.find(r => r.id === id)?.notes ?? '' })
                    }
                    onShiftEditOpen={handleOpenShiftEdit}
                    onReceptionCloseOpen={handleOpenReceptionClose}
                    onReceptionCloseClear={handleClearReceptionClosed}
                    onSettlementToggle={handleToggleSettlement}
                    onPaymentSettle={handlePaymentSettle}
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
            extensionUnitMinutes={extensionUnitMinutes}
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
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">メモ（任意）</label>
                        <input
                          type="text"
                          value={shiftEditModal.newBlockedMemo}
                          onChange={e => setShiftEditModal(m => m ? { ...m, newBlockedMemo: e.target.value } : null)}
                          placeholder="理由・備考など（例: 休憩、私用）"
                          className="w-full px-2 py-2 bg-white border border-rose-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-400/50 outline-none"
                        />
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
                        <div key={i} className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-rose-800 flex-1">{slot.startTime} ～ {slot.endTime}</span>
                            <button
                              onClick={() => setShiftEditModal(m => m ? { ...m, blockedSlots: m.blockedSlots.filter((_, j) => j !== i) } : null)}
                              className="text-rose-400 hover:text-rose-600 transition-colors p-0.5"
                              title="削除"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                          <input
                            type="text"
                            value={slot.memo}
                            onChange={e => setShiftEditModal(m => m ? {
                              ...m,
                              blockedSlots: m.blockedSlots.map((s, j) => j === i ? { ...s, memo: e.target.value } : s),
                            } : null)}
                            placeholder="メモ（任意）"
                            className="w-full mt-1.5 px-2 py-1 bg-white border border-rose-200 rounded text-xs focus:ring-2 focus:ring-rose-400/50 outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {shiftEditModal.blockedSlots.length === 0 && !shiftEditModal.addingBlocked && (
                    <p className="text-xs text-slate-400 text-center py-1.5">予約不可の時間帯はありません</p>
                  )}
                </div>
              )}

              {/* 精算済み */}
              <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${shiftEditModal.isSettled ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                <div>
                  <p className={`text-sm font-bold ${shiftEditModal.isSettled ? 'text-red-700' : 'text-slate-700'}`}>精算{shiftEditModal.isSettled ? '済み' : '未送信'}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">セラピストへ本日分の精算を送ったかどうかの状態です</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await handleToggleSettlement(shiftEditModal.therapistId, shiftEditModal.date, shiftEditModal.isSettled);
                    if (ok) setShiftEditModal(m => m ? { ...m, isSettled: !m.isSettled } : null);
                  }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${shiftEditModal.isSettled ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-red-600 text-white hover:bg-red-700'}`}
                >
                  {shiftEditModal.isSettled ? '未精算に戻す' : '精算済みにする'}
                </button>
              </div>

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
                {shiftEditModal.unresolvedMemos.map(memo => {
                  const isEditing = editingMemoId === memo.id;
                  if (isEditing) {
                    return (
                      <div key={memo.id} className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-2">
                        <textarea
                          value={editMemoForm.content}
                          onChange={e => setEditMemoForm(f => ({ ...f, content: e.target.value }))}
                          rows={1}
                          className="w-full px-2 py-1 bg-white border border-amber-200 rounded-md text-xs focus:ring-2 focus:ring-amber-400/50 outline-none resize-none"
                          placeholder="内容"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={editMemoForm.amount}
                              onChange={e => setEditMemoForm(f => ({ ...f, amount: e.target.value }))}
                              className="w-20 px-1.5 py-1 bg-white border border-amber-200 rounded-md text-xs focus:ring-2 focus:ring-amber-400/50 outline-none"
                              placeholder="金額"
                            />
                            <span className="text-[10px] text-slate-500">円</span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingMemoId(null)}
                              className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded transition-all"
                            >
                              キャンセル
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateMemo(memo.id)}
                              disabled={!editMemoForm.content.trim()}
                              className="px-2.5 py-1 text-[10px] font-bold text-white bg-amber-500 hover:bg-amber-600 rounded transition-all"
                            >
                              保存
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
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
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditMemoStart(memo)}
                          className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 border border-slate-200 hover:border-indigo-300 px-1.5 py-1 rounded transition-colors whitespace-nowrap"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleResolveMemo(memo.id, shiftEditModal.therapistId)}
                          className="text-[9px] font-bold text-slate-400 hover:text-emerald-600 border border-slate-200 hover:border-emerald-300 px-1.5 py-1 rounded transition-colors whitespace-nowrap"
                        >
                          解決済み
                        </button>
                      </div>
                    </div>
                  );
                })}
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
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">メモ</label>
                <textarea
                  value={blockedModal.memo}
                  onChange={e => setBlockedModal({ ...blockedModal, memo: e.target.value })}
                  rows={2}
                  placeholder="理由・備考など（例: 休憩、私用、送迎）"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none resize-none"
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

      {/* 受付終了モーダル */}
      {receptionCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setReceptionCloseModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-1">受付終了にする</h3>
            <p className="text-xs text-slate-500 mb-6">{receptionCloseModal.therapistName} / この時刻から {receptionCloseModal.shiftEnd} まで新規予約の受付を止めます</p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">締切時刻</label>
                <TimeSelectHM
                  value={receptionCloseModal.cutoffTime}
                  onChange={v => setReceptionCloseModal(m => m ? { ...m, cutoffTime: v } : null)}
                  selectClassName="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/50 outline-none"
                  minHour={9}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmReceptionClose}
                disabled={receptionCloseModal.saving}
                className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                受付終了にする
              </button>
              <button
                onClick={() => setReceptionCloseModal(null)}
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

export default function ShiftsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-slate-500 font-medium">読み込み中...</div>
      </div>
    }>
      <ShiftsContent />
    </Suspense>
  );
}
