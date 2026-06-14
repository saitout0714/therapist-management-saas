"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toDisplayTime } from '@/lib/timeUtils';
import Link from 'next/link';
import Image from 'next/image';

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
  isPending?: boolean;
  isHandled?: boolean;
  source?: string;
  paymentMethod?: string | null;
  customerNotified?: boolean;
  therapistNotified?: boolean;
  extensionMinutes?: number;
}

interface VerticalTimeChartProps {
  therapists: Therapist[];
  schedules?: Schedule[];
  date?: string; // YYYY-MM-DD format
  scrollToTime?: string | null;
  onBlockedClick?: (id: string, startTime: string, endTime: string) => void;
  onShiftEditOpen?: (therapistId: string, date?: string) => void;
}

const VerticalTimeChart: React.FC<VerticalTimeChartProps> = ({
  therapists: rawTherapists,
  schedules: rawSchedules = [],
  date,
  scrollToTime,
  onBlockedClick,
  onShiftEditOpen,
}) => {
  const router = useRouter();

  const therapists = useMemo(() => {
    return rawTherapists.map(t => ({
      ...t,
      shiftStart: t.shiftStart ? toDisplayTime(t.shiftStart) : undefined,
      shiftEnd: t.shiftEnd ? toDisplayTime(t.shiftEnd) : undefined,
    }));
  }, [rawTherapists]);

  const schedules = useMemo(() => {
    return rawSchedules.map(s => ({
      ...s,
      startTime: toDisplayTime(s.startTime),
      endTime: toDisplayTime(s.endTime),
    }));
  }, [rawSchedules]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrolledRef = useRef<string | null>(null);

  // Popups state
  const [hoverData, setHoverData] = useState<{ x: number; y: number; time: string } | null>(null);
  const [memoPopup, setMemoPopup] = useState<{ therapistId: string; x: number; y: number } | null>(null);
  const [roomMemoPopup, setRoomMemoPopup] = useState<{ roomName: string; memo: string; mapUrl: string | null; x: number; y: number } | null>(null);
  const roomMemoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [therapistPopup, setTherapistPopup] = useState<{ therapist: Therapist; x: number; y: number } | null>(null);
  const therapistPopupHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobile Directional Scroll Lock Refs & State
  const [scrollLock, setScrollLock] = useState<'x' | 'y' | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const scrollLockRef = useRef<'x' | 'y' | null>(null);
  const initialScrollLeft = useRef<number>(0);
  const initialScrollTop = useRef<number>(0);
  const lockAppliedRef = useRef<boolean>(false);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleTouchStartNative = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };
        lastTouchRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };
        initialScrollLeft.current = container.scrollLeft;
        initialScrollTop.current = container.scrollTop;
        lockAppliedRef.current = false;
        scrollLockRef.current = null;
        setScrollLock(null);
      }
    };

    const handleTouchMoveNative = (e: TouchEvent) => {
      if (!touchStartRef.current || !lastTouchRef.current) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;

      const deltaXFromStart = currentX - touchStartRef.current.x;
      const deltaYFromStart = currentY - touchStartRef.current.y;

      const absXStart = Math.abs(deltaXFromStart);
      const absYStart = Math.abs(deltaYFromStart);

      // Determine locking axis if not determined yet
      if (!lockAppliedRef.current) {
        if (absXStart > 8 || absYStart > 8) {
          if (absYStart > absXStart * 1.2) {
            scrollLockRef.current = 'x'; // Horizontal locked (Vertical scroll allowed)
            setScrollLock('x');
          } else if (absXStart > absYStart * 1.2) {
            scrollLockRef.current = 'y'; // Vertical locked (Horizontal scroll allowed)
            setScrollLock('y');
          }
          lockAppliedRef.current = true;
        }
      }

      // Apply lock via e.preventDefault() for opposing movements
      if (lockAppliedRef.current) {
        const deltaX = currentX - lastTouchRef.current.x;
        const deltaY = currentY - lastTouchRef.current.y;

        if (scrollLockRef.current === 'x') {
          // Horizontal is locked, prevent horizontal scroll
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            e.preventDefault();
          }
        } else if (scrollLockRef.current === 'y') {
          // Vertical is locked, prevent vertical scroll
          if (Math.abs(deltaY) > Math.abs(deltaX)) {
            e.preventDefault();
          }
        }
      }

      lastTouchRef.current = { x: currentX, y: currentY };
    };

    const handleTouchEndNative = () => {
      touchStartRef.current = null;
      lastTouchRef.current = null;
      lockAppliedRef.current = false;
      scrollLockRef.current = null;
      setScrollLock(null);
    };

    const handleScrollNative = () => {
      if (scrollLockRef.current === 'x') {
        if (container.scrollLeft !== initialScrollLeft.current) {
          container.scrollLeft = initialScrollLeft.current;
        }
      } else if (scrollLockRef.current === 'y') {
        if (container.scrollTop !== initialScrollTop.current) {
          container.scrollTop = initialScrollTop.current;
        }
      }
    };

    container.addEventListener('touchstart', handleTouchStartNative, { passive: true });
    container.addEventListener('touchmove', handleTouchMoveNative, { passive: false });
    container.addEventListener('touchend', handleTouchEndNative, { passive: true });
    container.addEventListener('touchcancel', handleTouchEndNative, { passive: true });
    container.addEventListener('scroll', handleScrollNative, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStartNative);
      container.removeEventListener('touchmove', handleTouchMoveNative);
      container.removeEventListener('touchend', handleTouchEndNative);
      container.removeEventListener('touchcancel', handleTouchEndNative);
      container.removeEventListener('scroll', handleScrollNative);
    };
  }, []);

  // Time grid configuration
  const cellHeight = 10; // Height per 5 minutes cell
  const columnWidth = 160; // Width of each therapist column
  const headerHeight = 76; // Height of the top header row
  const timeColumnWidth = 60; // Width of left sticky time column

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let h = 10; h < 30; h++) {
      const displayHour = h % 24;
      for (let m = 0; m < 60; m += 5) {
        slots.push(`${String(displayHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return slots;
  }, []);

  const hourLabels = useMemo(() => {
    const labels: string[] = [];
    for (let h = 10; h < 30; h++) {
      const displayHour = h % 24;
      labels.push(`${String(displayHour).padStart(2, '0')}:00`);
    }
    return labels;
  }, []);

  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (hours >= 10) {
      return (hours - 10) * 60 + minutes;
    } else {
      return (24 - 10) * 60 + hours * 60 + minutes;
    }
  };

  const isCellInShift = (therapist: Therapist, timeSlotIndex: number): boolean => {
    if (!therapist.shiftStart || !therapist.shiftEnd) {
      return true;
    }
    const shiftStartMinutes = timeToMinutes(therapist.shiftStart);
    const shiftEndMinutes = timeToMinutes(therapist.shiftEnd);
    const cellTimeMinutes = timeSlotIndex * 5;

    if (shiftEndMinutes < shiftStartMinutes) {
      return cellTimeMinutes >= shiftStartMinutes || cellTimeMinutes < shiftEndMinutes;
    } else {
      return cellTimeMinutes >= shiftStartMinutes && cellTimeMinutes < shiftEndMinutes;
    }
  };

  const getCellBackgroundStyle = (isInShift: boolean) => {
    if (isInShift) {
      return { backgroundColor: '#FFFFFF' };
    } else {
      return {
        backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.04), rgba(0,0,0,0.04) 10px, transparent 10px, transparent 20px)',
        backgroundColor: '#E8ECF1',
      };
    }
  };

  // Auto scroll effect
  useEffect(() => {
    const scrollKey = `${date}_${scrollToTime}`;
    if (lastScrolledRef.current === scrollKey) return;

    const getBusinessDateString = () => {
      const now = new Date();
      if (now.getHours() < 6) now.setDate(now.getDate() - 1);
      return now.toISOString().split('T')[0];
    };

    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        let idx = 0;
        let foundTime = false;

        // 1. Scroll to target time
        if (scrollToTime) {
          const parts = scrollToTime.split(':');
          if (parts.length >= 2) {
            const sh = parseInt(parts[0], 10);
            const sm = parseInt(parts[1], 10);
            if (!isNaN(sh) && !isNaN(sm)) {
              let adjustedHour = sh;
              if (sh < 10) adjustedHour += 24;
              if (adjustedHour >= 10 && adjustedHour <= 29) {
                idx = (adjustedHour - 10) * 12 + Math.floor(sm / 5);
                foundTime = true;
              }
            }
          }
        }

        // 2. Scroll to current time of today's business day
        if (!foundTime) {
          const todayStr = getBusinessDateString();
          const isToday = !date || date === todayStr;

          if (isToday) {
            const now = new Date();
            const h = now.getHours();
            const m = now.getMinutes();
            let adjustedHour = h;
            if (h < 10) adjustedHour += 24;
            if (adjustedHour >= 10 && adjustedHour <= 29) {
              idx = (adjustedHour - 10) * 12 + Math.floor(m / 5);
              foundTime = true;
            }
          }
        }

        // 3. Scroll to earliest shift or reservation
        if (!foundTime) {
          let minMinutes = Infinity;

          therapists.forEach((t) => {
            if (t.shiftStart) {
              minMinutes = Math.min(minMinutes, timeToMinutes(t.shiftStart));
            }
          });

          schedules.forEach((s) => {
            if (s.startTime && s.type !== 'interval') {
              minMinutes = Math.min(minMinutes, timeToMinutes(s.startTime));
            }
          });

          if (minMinutes !== Infinity) {
            idx = Math.floor(minMinutes / 5);
            foundTime = true;
          }
        }

        if (foundTime) {
          const containerHeight = scrollContainerRef.current.clientHeight;
          // Calculate target scrollTop: headerHeight offset + cell position - half of container height
          const scrollPosition = headerHeight + idx * cellHeight - containerHeight / 2;
          scrollContainerRef.current.scrollTop = Math.max(0, scrollPosition);
          lastScrolledRef.current = scrollKey;
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [date, scrollToTime, therapists, schedules]);

  const now = new Date();
  const nowHour = now.getHours();
  const nowMin = now.getMinutes();
  let showSeek = false;
  let seekIndex = 0;

  let adjustedNowHour = nowHour;
  if (nowHour < 10) adjustedNowHour += 24;

  if (adjustedNowHour >= 10 && adjustedNowHour <= 29) {
    showSeek = true;
    seekIndex = (adjustedNowHour - 10) * 12 + Math.floor(nowMin / 5);
  }

  return (
    <div className="relative w-full h-full bg-slate-50 border border-slate-200 rounded-lg shadow-inner overflow-hidden">
      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        className="w-full h-full custom-scrollbar select-none"
        style={{
          cursor: 'default',
          overflowX: scrollLock === 'x' ? 'hidden' : 'auto',
          overflowY: scrollLock === 'y' ? 'hidden' : 'auto',
        }}
      >
        {/* Scroll Content Wrap */}
        <div className="relative min-w-max min-h-max">
          
          {/* Top Sticky Header */}
          <div
            className="sticky top-0 flex z-30 bg-white border-b border-slate-200 shadow-sm"
            style={{ height: `${headerHeight}px` }}
          >
            {/* Top-Left Sticky Corner Spacer */}
            <div
              className="sticky left-0 bg-slate-100 border-r border-b border-slate-200 z-40 flex-shrink-0"
              style={{ width: `${timeColumnWidth}px`, height: `${headerHeight}px` }}
            />

            {/* Therapist Column Headers */}
            {therapists.map((therapist) => {
              const isOff = therapist.id !== 'unassigned' && therapist.shiftStart && therapist.shiftEnd && schedules.some(
                s =>
                  s.therapistId === therapist.id &&
                  s.type === 'blocked' &&
                  s.startTime === therapist.shiftStart &&
                  s.endTime === therapist.shiftEnd
              );

              return (
                <div
                  key={`header-${therapist.id}`}
                  className={`border-r border-slate-200 flex-shrink-0 flex items-stretch transition-colors group relative overflow-hidden
                    ${isOff ? 'bg-slate-100/80 hover:bg-slate-200/50 text-slate-400 border-l-4 border-rose-300' : 'bg-white hover:bg-indigo-50/40'}`}
                  style={{ width: `${columnWidth}px`, height: `${headerHeight}px` }}
                >
                  {/* Active indicator bar */}
                  {!isOff && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}

                  {/* 写真 — 3:4固定比率 */}
                  <div className="w-[42px] flex-shrink-0 self-center pl-1.5 py-1">
                    <div className={`relative w-full overflow-hidden rounded bg-slate-100 flex items-center justify-center border border-slate-200 ${isOff ? 'opacity-40' : ''}`} style={{ aspectRatio: '3/4' }}>
                      {therapist.id === 'unassigned' ? (
                        <div className="w-full h-full flex items-center justify-center bg-amber-50 text-amber-500">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                      ) : therapist.avatar ? (
                        <Image src={therapist.avatar} alt={therapist.name} fill className="object-cover" unoptimized />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center text-lg font-bold text-slate-300">{therapist.name[0]}</span>
                      )}
                    </div>
                  </div>

                  {/* テキスト情報 */}
                  <div className="flex flex-col justify-center flex-1 min-w-0 px-2 py-1.5 gap-[4px]">
                    {/* 名前 */}
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <p
                        className={`text-[13px] font-bold leading-none group-hover:text-indigo-700 transition-colors cursor-default truncate
                          ${isOff ? 'text-slate-400' : 'text-slate-800'}`}
                        onMouseEnter={(e) => {
                          if (therapist.id === 'unassigned') return;
                          if (therapistPopupHideTimer.current) clearTimeout(therapistPopupHideTimer.current);
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setTherapistPopup({ therapist, x: rect.left, y: rect.bottom + 4 });
                        }}
                        onMouseLeave={() => {
                          if (therapist.id === 'unassigned') return;
                          therapistPopupHideTimer.current = setTimeout(() => setTherapistPopup(null), 150);
                        }}
                      >
                        {therapist.name}
                      </p>
                      {isOff && (
                        <span className="flex-shrink-0 text-[9px] font-extrabold px-1.5 py-0.5 leading-none rounded bg-rose-100 text-rose-700 border border-rose-200">
                          休み
                        </span>
                      )}
                      {(therapist.unresolvedMemos?.length ?? 0) > 0 && (
                        <span
                          className="flex-shrink-0 flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 leading-none rounded bg-rose-50 text-rose-600 border border-rose-200 animate-pulse-subtle cursor-default truncate max-w-[120px]"
                          title={`引継メモ: ${therapist.unresolvedMemos!.map(m => m.content).join(', ')}`}
                          onMouseEnter={e => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setMemoPopup({ therapistId: therapist.id, x: rect.right + 6, y: rect.top });
                          }}
                          onMouseLeave={() => setMemoPopup(null)}
                        >
                          <svg className="w-3 h-3 text-rose-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                          <span>引継: {therapist.unresolvedMemos![0].content}</span>
                        </span>
                      )}
                    </div>

                    {/* 出勤時間 */}
                    <p className="text-[11px] font-semibold leading-none whitespace-nowrap">
                      {therapist.id === 'unassigned' ? (
                        <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold">要対応</span>
                      ) : isOff ? (
                        <span className="text-slate-400 line-through">{therapist.shiftStart}〜{therapist.shiftEnd}</span>
                      ) : therapist.shiftStart && therapist.shiftEnd ? (
                        <span className="text-emerald-600">{therapist.shiftStart}〜{therapist.shiftEnd}</span>
                      ) : (
                        <span className="text-slate-400">未設定</span>
                      )}
                    </p>

                    {/* ルーム + インターバル */}
                    <div className={`flex items-center gap-1.5 flex-wrap ${isOff ? 'opacity-40' : ''}`}>
                      {therapist.room && (
                        <span
                          className="text-[10px] text-slate-500 font-medium whitespace-nowrap flex items-center gap-0.5 cursor-default leading-none"
                          onMouseEnter={(e) => {
                            if (roomMemoHideTimer.current) clearTimeout(roomMemoHideTimer.current);
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setRoomMemoPopup({ roomName: therapist.room ?? '', memo: therapist.roomMemo ?? '', mapUrl: therapist.roomMapUrl ?? null, x: rect.left, y: rect.bottom + 4 });
                          }}
                          onMouseLeave={() => {
                            roomMemoHideTimer.current = setTimeout(() => setRoomMemoPopup(null), 150);
                          }}
                        >
                          <svg className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          {therapist.room}
                        </span>
                      )}
                      {therapist.id !== 'unassigned' && (
                        <span className="flex-shrink-0 text-[9px] font-medium px-1.5 py-0.5 leading-none rounded bg-slate-100 text-slate-500 border border-slate-200">
                          {therapist.intervalMinutes && therapist.intervalMinutes > 0 ? `${therapist.intervalMinutes}分` : '20分'}
                        </span>
                      )}
                    </div>

                    {/* notes */}
                    {therapist.notes && (
                      <p className="text-[9px] text-amber-600 font-medium leading-none whitespace-nowrap truncate" title={therapist.notes}>
                        {therapist.notes}
                      </p>
                    )}
                  </div>

                  {onShiftEditOpen && therapist.id !== 'unassigned' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShiftEditOpen(therapist.id, date);
                      }}
                      title="シフトを編集"
                      className="flex-shrink-0 flex items-center justify-center self-center mr-1 w-6 h-6 rounded-md text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Grid Area - Flex layout with left sticky time and columns side by side */}
          <div className="flex relative">
            
            {/* Left Sticky Time Column */}
            <div
              className="sticky left-0 bg-slate-100 border-r border-slate-200 z-20 flex-shrink-0 select-none shadow-sm"
              style={{ width: `${timeColumnWidth}px` }}
            >
              {hourLabels.map((label, idx) => (
                <div
                  key={`hour-label-${idx}`}
                  className="border-b border-slate-200/80 relative bg-slate-100 flex items-start p-1.5"
                  style={{ height: `${cellHeight * 12}px` }}
                >
                  <span className="text-[11px] font-bold text-slate-500 leading-none">
                    {label}
                  </span>
                  <span className="absolute top-[60px] left-1.5 text-[9px] font-medium text-slate-400/80 leading-none">
                    {String(parseInt(label.split(':')[0]) + 0).padStart(2, '0')}:30
                  </span>
                </div>
              ))}
            </div>

            {/* Grid columns */}
            <div className="flex-1 relative flex" style={{ height: `${timeSlots.length * cellHeight}px` }}>
              
              {/* Seek Bar Line (Horizontal indicator) */}
              {showSeek && seekIndex > 0 && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: `${seekIndex * cellHeight}px`,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: 'linear-gradient(to right, rgb(99 102 241), rgba(99, 102, 241, 0.15))',
                    zIndex: 10,
                    boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.1)',
                  }}
                />
              )}

              {/* Grid Cells column-by-column */}
              {therapists.map((therapist, tIdx) => (
                <div
                  key={`col-${therapist.id}`}
                  className="border-r border-slate-200 flex-shrink-0 relative bg-slate-50/50"
                  style={{ width: `${columnWidth}px` }}
                >
                  {timeSlots.map((timeSlot, idx) => {
                    const inShift = isCellInShift(therapist, idx);
                    const cellStyle = getCellBackgroundStyle(inShift);

                    const handleCellClick = () => {
                      if (!date || therapist.id === 'unassigned') return;
                      router.push(`/reservations/new?from=vertical&therapist_id=${therapist.id}&date=${date}&time=${timeSlot}`);
                    };

                    return (
                      <div
                        key={`${therapist.id}-${idx}`}
                        className={`border-b border-slate-100/50 ${therapist.id !== 'unassigned' ? 'hover:bg-indigo-50/40 transition-colors' : ''}`}
                        style={{ ...cellStyle, height: `${cellHeight}px`, cursor: therapist.id === 'unassigned' ? 'default' : 'pointer' }}
                        onClick={handleCellClick}
                        onMouseEnter={(e) => {
                          if (therapist.id === 'unassigned') return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHoverData({
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                            time: timeSlot
                          });
                        }}
                        onMouseLeave={() => setHoverData(null)}
                      />
                    );
                  })}
                </div>
              ))}

              {/* Schedules Layer - absolute overlays */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ top: 0, left: 0, right: 0, bottom: 0 }}
              >
                {schedules.map((schedule, idx) => {
                  const therapistIndex = therapists.findIndex(t => t.id === schedule.therapistId);
                  if (therapistIndex === -1) return null;

                  const startMinutes = timeToMinutes(schedule.startTime);
                  const endMinutes = timeToMinutes(schedule.endTime);
                  const duration = endMinutes - startMinutes;

                  const top = startMinutes * (cellHeight / 5);
                  const height = duration * (cellHeight / 5);
                  const left = therapistIndex * columnWidth + 4;
                  const width = columnWidth - 8;

                  const handleScheduleClick = () => {
                    if (schedule.type === 'reservation' && schedule.reservationId) {
                      router.push(`/reservations/${schedule.reservationId}?from=vertical`);
                    }
                  };

                  const isReservation = schedule.type === 'reservation';
                  const isInterval = schedule.type === 'interval';
                  const isBlocked = schedule.type === 'blocked';

                  // 1. Blocked slot
                  if (isBlocked) {
                    return (
                      <div
                        key={`schedule-${idx}`}
                        className="absolute flex items-center justify-center overflow-hidden cursor-pointer pointer-events-auto shadow-sm hover:shadow-md hover:z-20 transition-all"
                        style={{
                          top: `${top + 1}px`,
                          left: `${left}px`,
                          width: `${width}px`,
                          height: `${height - 2}px`,
                          borderRadius: '6px',
                          background: 'repeating-linear-gradient(45deg, rgba(153,0,30,0.75), rgba(153,0,30,0.75) 5px, rgba(180,20,50,0.55) 5px, rgba(180,20,50,0.55) 10px)',
                          border: '1px solid rgba(120,0,20,0.9)',
                        }}
                        title={`${schedule.startTime}～${schedule.endTime} 予約不可`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onBlockedClick && schedule.reservationId) {
                            onBlockedClick(schedule.reservationId, schedule.startTime, schedule.endTime);
                          }
                        }}
                      >
                        <span className="text-[9px] font-bold text-rose-50 leading-none truncate px-1 text-center" style={{ textShadow: '0 1px 2px rgba(80,0,10,0.7)' }}>
                          予約不可
                        </span>
                      </div>
                    );
                  }

                  // 2. Interval slot
                  if (isInterval) {
                    return (
                      <div
                        key={`schedule-${idx}`}
                        className="absolute flex items-center justify-center overflow-hidden"
                        style={{
                          top: `${top + 1}px`,
                          left: `${left}px`,
                          width: `${width}px`,
                          height: `${height - 2}px`,
                          borderRadius: '6px',
                          background: 'repeating-linear-gradient(45deg, rgba(107, 114, 128, 0.1), rgba(107, 114, 128, 0.1) 4px, rgba(156, 163, 175, 0.03) 4px, rgba(156, 163, 175, 0.03) 8px)',
                          border: '1px dashed rgba(75, 85, 99, 0.4)',
                        }}
                        title={schedule.title}
                      >
                        <span className="text-[8px] font-bold text-slate-400 leading-none">
                          INT
                        </span>
                      </div>
                    );
                  }

                  // 3. Pending reservation (Web booking)
                  if (isReservation && schedule.isPending) {
                    return (
                      <div
                        key={`schedule-${idx}`}
                        className="absolute rounded-lg px-2 flex flex-col justify-start cursor-default pointer-events-auto transition-transform hover:-translate-y-0.5 hover:z-20 hover:shadow-lg border-2 border-dashed border-amber-500 bg-amber-50/95 text-amber-900"
                        style={{
                          top: `${top + 1}px`,
                          left: `${left}px`,
                          width: `${width}px`,
                          height: `${height - 2}px`,
                        }}
                        title={`${schedule.customerName || schedule.title} (${schedule.startTime} - ${schedule.endTime}) 仮予約`}
                        onClick={handleScheduleClick}
                      >
                        <div className="w-full h-full flex flex-col justify-start gap-1 overflow-hidden py-1.5">
                          <div className="text-[10px] font-medium text-amber-800 leading-none flex items-center gap-1">
                            <span className="whitespace-nowrap">{schedule.startTime}-{schedule.endTime}</span>
                            <span className="text-[9px] font-bold bg-amber-500 text-white px-1 rounded-sm">仮</span>
                          </div>
                          <div className="flex items-center justify-start gap-1 min-w-0">
                            <span className="font-bold text-[13px] text-amber-950 leading-none truncate">
                              {schedule.customerName || schedule.title}
                            </span>
                            {schedule.paymentMethod === 'credit' && (
                              <span className="flex-shrink-0 text-[9px] px-1 rounded-sm font-bold bg-amber-500 text-white shadow-sm whitespace-nowrap">
                                💳 クレジット
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-medium text-amber-800 flex items-center gap-1 leading-none flex-wrap">
                            {schedule.courseDuration && (
                              <span className="opacity-80">{schedule.courseDuration}分</span>
                            )}
                            {schedule.extensionMinutes !== undefined && schedule.extensionMinutes > 0 && (
                              <span className="bg-amber-500 text-white px-1 rounded-sm text-[9px] font-bold border border-amber-400">
                                延長+{schedule.extensionMinutes}分
                              </span>
                            )}
                            {schedule.totalPrice !== undefined && (
                              <span className="text-[11px] font-extrabold bg-amber-200/60 px-1 py-0 rounded">
                                ¥{schedule.totalPrice.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // 4. Normal reservation
                  const isNotificationUnsent = isReservation && !schedule.isPending && (!schedule.customerNotified || !schedule.therapistNotified);
                  const isWeb = schedule.source === 'web';
                  const bgClasses = schedule.color
                    ? ''
                    : isReservation
                      ? schedule.isHime
                        ? isNotificationUnsent
                          ? 'bg-gradient-to-br from-[#e27396] to-[#c35175] border border-amber-400 shadow-md shadow-amber-500/20 animate-pulse-subtle'
                          : 'bg-gradient-to-br from-[#e27396] to-[#c35175] border border-[#c35175]/30'
                        : isWeb
                          ? isNotificationUnsent
                            ? 'bg-gradient-to-br from-[#f59e0b] to-[#ea580c] border border-amber-300 shadow-md shadow-amber-500/20 animate-pulse-subtle'
                            : 'bg-gradient-to-br from-teal-600 to-emerald-700 border border-teal-500/30'
                          : isNotificationUnsent
                            ? 'bg-gradient-to-br from-[#f59e0b] to-[#ea580c] border border-amber-300 shadow-md shadow-amber-500/20 animate-pulse-subtle'
                            : 'bg-gradient-to-br from-[#1f3c6d] to-[#0a1b3a] border border-[#0a1b3a]/30'
                      : 'bg-gradient-to-br from-slate-600 to-slate-700 border border-slate-500';

                  return (
                    <div
                      key={`schedule-${idx}`}
                      className={`absolute rounded-lg px-2 flex flex-col justify-start cursor-default pointer-events-auto transition-transform hover:-translate-y-0.5 hover:z-20 hover:shadow-lg ${bgClasses}`}
                      style={{
                        top: `${top + 1}px`,
                        left: `${left}px`,
                        width: `${width}px`,
                        height: `${height - 2}px`,
                        ...(schedule.color ? { backgroundColor: schedule.color, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid rgba(0,0,0,0.1)' } : {}),
                        color: 'white',
                      }}
                      title={`${schedule.title} (${schedule.startTime} - ${schedule.endTime})`}
                      onClick={handleScheduleClick}
                    >
                      {/* Inner content wrapper to handle overflow nicely */}
                      <div className="w-full h-full flex flex-col justify-start gap-1 overflow-hidden py-1.5">
                        {/* Row 1: Time & Notification status */}
                        <div className="text-[10px] font-medium text-white leading-none flex items-center gap-1.5 flex-wrap">
                          <span className="whitespace-nowrap">{schedule.startTime}-{schedule.endTime}</span>
                          {isReservation && !schedule.isPending && !schedule.customerNotified && (
                            <span className="bg-rose-500 text-white font-extrabold px-1 rounded-sm text-[8px] scale-90 origin-left whitespace-nowrap shadow-sm border border-rose-400" title="お客様未送信">客未</span>
                          )}
                          {isReservation && !schedule.isPending && !schedule.therapistNotified && (
                            <span className="bg-rose-500 text-white font-extrabold px-1 rounded-sm text-[8px] scale-90 origin-left whitespace-nowrap shadow-sm border border-rose-400" title="セラピスト未送信">セラ未</span>
                          )}
                        </div>

                        {/* Row 2: Name and New/Member */}
                        <div className="flex items-center justify-start gap-1 min-w-0">
                          <span className="font-bold text-[13px] text-white leading-none truncate drop-shadow-sm">
                            {schedule.customerName || schedule.title}
                          </span>
                          {isReservation && (
                            <span className={`flex-shrink-0 text-[9px] px-1 rounded-sm font-bold ${schedule.isNewCustomer ? 'bg-rose-400/90' : 'bg-emerald-400/90'} text-white shadow-sm`}>
                              {schedule.isNewCustomer ? '新規' : '会員'}
                            </span>
                          )}
                          {isReservation && schedule.paymentMethod === 'credit' && (
                            <span className="flex-shrink-0 text-[9px] px-1 rounded-sm font-bold bg-amber-400 text-slate-900 border border-amber-300 shadow-sm whitespace-nowrap">
                              💳 クレジット
                            </span>
                          )}
                        </div>

                        {/* Row 3: Duration, Designation, Extension and Price */}
                        <div className="text-[10px] font-medium text-white flex items-center gap-1 leading-none flex-wrap">
                          {schedule.courseDuration && (
                            <span className="opacity-90">{schedule.courseDuration}分</span>
                          )}
                          {schedule.extensionMinutes !== undefined && schedule.extensionMinutes > 0 && (
                            <span className="bg-amber-50/90 text-slate-900 px-1 rounded-sm text-[9px] font-bold border border-amber-400/40">
                              延長+{schedule.extensionMinutes}分
                            </span>
                          )}
                          {schedule.designationLabel && (
                            <span className="bg-white/20 px-1 rounded-sm text-[9px] text-white border border-white/10">{schedule.designationLabel}</span>
                          )}
                          {isReservation && schedule.totalPrice !== undefined && (
                            <span className="text-[11px] font-extrabold text-white bg-black/15 px-1 py-0 rounded backdrop-blur-[1px]">
                              ¥{schedule.totalPrice.toLocaleString()}
                            </span>
                          )}
                          {isReservation && schedule.discountAmount !== undefined && (
                            <span className="text-[10px] font-bold text-rose-200 bg-rose-500/30 px-1 py-0 rounded border border-rose-300/20">
                              -¥{schedule.discountAmount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

          </div>

        </div>
      </div>

      {/* Hover popups */}
      {hoverData && (
        <div
          className="fixed pointer-events-none z-50 bg-slate-800 text-white font-bold text-xs rounded shadow-lg px-2.5 py-1.5 whitespace-nowrap transform -translate-x-1/2 -translate-y-full transition-opacity duration-75"
          style={{ top: hoverData.y - 4, left: hoverData.x }}
        >
          {hoverData.time}
          <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full w-0 h-0 border-l-[4px] border-l-transparent border-t-[4px] border-t-slate-800 border-r-[4px] border-r-transparent"></div>
        </div>
      )}

      {/* Therapist Popup */}
      {therapistPopup && (
        <div
          className="fixed z-[9999]"
          style={{ left: `${therapistPopup.x}px`, top: `${therapistPopup.y}px` }}
          onMouseEnter={() => { if (therapistPopupHideTimer.current) clearTimeout(therapistPopupHideTimer.current); }}
          onMouseLeave={() => setTherapistPopup(null)}
        >
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-100 p-3 space-y-2">
            {(therapistPopup.therapist.age || therapistPopup.therapist.height) && (
              <div className="flex gap-1.5 flex-wrap">
                {therapistPopup.therapist.age && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">{therapistPopup.therapist.age}歳</span>
                )}
                {therapistPopup.therapist.height && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">{therapistPopup.therapist.height}cm</span>
                )}
              </div>
            )}
            {(therapistPopup.therapist.bust || therapistPopup.therapist.waist || therapistPopup.therapist.hip) && (
              <div className="flex gap-1.5 flex-wrap">
                {therapistPopup.therapist.bust && (
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-full text-xs font-semibold">
                    B{therapistPopup.therapist.bust}{therapistPopup.therapist.bustCup ?? ''}
                  </span>
                )}
                {therapistPopup.therapist.waist && (
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-full text-xs font-semibold">W{therapistPopup.therapist.waist}</span>
                )}
                {therapistPopup.therapist.hip && (
                  <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-full text-xs font-semibold">H{therapistPopup.therapist.hip}</span>
                )}
              </div>
            )}
            {therapistPopup.therapist.staffMemo && (
              <p className="text-xs text-amber-900 leading-relaxed whitespace-pre-wrap bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">{therapistPopup.therapist.staffMemo}</p>
            )}
          </div>
        </div>
      )}

      {/* Room Memo Popup */}
      {roomMemoPopup && (
        <div
          className="fixed z-[9999]"
          style={{ left: `${roomMemoPopup.x}px`, top: `${roomMemoPopup.y}px` }}
          onMouseEnter={() => { if (roomMemoHideTimer.current) clearTimeout(roomMemoHideTimer.current); }}
          onMouseLeave={() => setRoomMemoPopup(null)}
        >
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-100 p-3 space-y-2">
            {roomMemoPopup.memo ? (
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{roomMemoPopup.memo}</p>
            ) : (
              !roomMemoPopup.mapUrl && (
                <p className="text-xs text-slate-400 italic">メモはありません</p>
              )
            )}
            {roomMemoPopup.mapUrl && (
              <a
                href={roomMemoPopup.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all text-white font-bold rounded-lg px-3 py-2 w-full text-xs"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Googleマップを開く
              </a>
            )}
          </div>
        </div>
      )}

      {/* Memo Popup */}
      {memoPopup && (() => {
        const t = therapists.find(th => th.id === memoPopup.therapistId);
        if (!t?.unresolvedMemos?.length) return null;
        return (
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{ left: `${memoPopup.x}px`, top: `${memoPopup.y}px` }}
          >
            <div className="bg-white border border-amber-300 rounded-xl shadow-xl p-3 w-64">
              <p className="text-[10px] font-bold text-amber-700 mb-2 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                引き継ぎメモ（{t.unresolvedMemos.length}件）
              </p>
              <div className="space-y-2">
                {t.unresolvedMemos.map(memo => (
                  <div key={memo.id} className="bg-amber-50 rounded-lg px-2.5 py-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-bold text-amber-700">{memo.date}</span>
                      {memo.amount !== 0 && (
                        <span className={`text-[9px] font-bold px-1.5 rounded ${memo.amount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                          {memo.amount > 0 ? `+${memo.amount.toLocaleString()}` : memo.amount.toLocaleString()}円
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 leading-snug">{memo.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8fafc;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
          border: 2px solid #f8fafc;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        @keyframes pulseSubtle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.95; transform: scale(0.985); }
        }
        .animate-pulse-subtle {
          animation: pulseSubtle 2.5s infinite ease-in-out;
        }
      `}} />

    </div>
  );
};

export default VerticalTimeChart;
