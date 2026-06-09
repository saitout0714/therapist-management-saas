'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Therapist {
  id: string;
  name: string;
  avatar?: string;
  shiftStart?: string; // "HH:mm" format
  shiftEnd?: string; // "HH:mm" format
  room?: string; // ルーム名
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
  unresolvedMemos?: { id: string; date: string; content: string; amount: number }[];
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

interface TimeChartProps {
  therapists: Therapist[];
  schedules?: Schedule[];
  date?: string; // YYYY-MM-DD format
  onBlockedClick?: (id: string, startTime: string, endTime: string) => void;
  onShiftEditOpen?: (therapistId: string) => void;
}

import { toDisplayTime } from '@/lib/timeUtils';

const TimeChart: React.FC<TimeChartProps> = ({
  therapists: rawTherapists,
  schedules: rawSchedules = [],
  date,
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

  // スクロール同期用のref
  const headerTimelineRef = useRef<HTMLDivElement>(null);
  const contentTimelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartScrollLeft, setDragStartScrollLeft] = useState(0);
  const [hoverData, setHoverData] = useState<{ x: number, y: number, time: string } | null>(null);
  const [memoPopup, setMemoPopup] = useState<{ therapistId: string; x: number; y: number } | null>(null);
  const [roomMemoPopup, setRoomMemoPopup] = useState<{ roomName: string; memo: string; mapUrl: string | null; x: number; y: number } | null>(null);
  const roomMemoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [therapistPopup, setTherapistPopup] = useState<{ therapist: Therapist; x: number; y: number } | null>(null);
  const therapistPopupHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragDistanceRef = useRef(0);

  // スクロール同期ハンドラー（コンテンツがスクロール時、ヘッダーを同期）
  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;

    // ヘッダーの時間軸をスクロール
    if (headerTimelineRef.current) {
      headerTimelineRef.current.scrollLeft = scrollLeft;
    }
  };

  // スクロール同期ハンドラー（ヘッダーがスクロール時、コンテンツを同期）
  const handleHeaderScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;

    // コンテンツのタイムラインをスクロール
    if (contentTimelineRef.current) {
      contentTimelineRef.current.scrollLeft = scrollLeft;
    }
  };

  // ドラッグ開始
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!contentTimelineRef.current) return;

    const startScrollLeft = contentTimelineRef.current.scrollLeft;
    const startClientX = e.clientX;
    dragDistanceRef.current = 0;

    // ドラッグ中のマウスムーブを処理
    const handleDragMove = (moveEvent: MouseEvent) => {
      if (!contentTimelineRef.current) return;

      const distance = Math.abs(moveEvent.clientX - startClientX);
      dragDistanceRef.current = distance;

      // 5px以上の移動でドラッグと判定
      if (distance > 5) {
        setIsDragging(true);
        moveEvent.preventDefault(); // デフォルトのドラッグ操作（テキスト選択等）をキャンセル
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'default';
      }

      const deltaX = moveEvent.clientX - startClientX;
      const newScrollLeft = startScrollLeft - deltaX;

      contentTimelineRef.current.scrollLeft = newScrollLeft;
      if (headerTimelineRef.current) {
        headerTimelineRef.current.scrollLeft = newScrollLeft;
      }
    };

    // ドラッグ終了
    const handleDragEnd = () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('blur', handleDragEnd);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      setHoverData(null); // ドラッグ終了時にも消す
      setTimeout(() => {
        setIsDragging(false);
        dragDistanceRef.current = 0; // ドラッグ終了後にリセットしてホバーを復活させる
      }, 50); // slight delay to prevent click fire
    };

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('blur', handleDragEnd); // ウィンドウフォーカスが外れた場合も追跡終了
  };

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 10; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 5) {
        slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
      }
    }
    for (let hour = 24; hour <= 29; hour++) {
      for (let minute = 0; minute < 60; minute += 5) {
        slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
      }
    }
    return slots;
  }, []);

  const hourLabels = useMemo(() => {
    const labels = [];
    for (let hour = 10; hour < 24; hour++) {
      labels.push(`${String(hour).padStart(2, '0')}時`);
    }
    for (let hour = 24; hour <= 29; hour++) {
      labels.push(`${String(hour).padStart(2, '0')}時`);
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

  useEffect(() => {
    setTimeout(() => {
      if (contentTimelineRef.current) {
        const now = new Date();
        const h = now.getHours();
        const m = now.getMinutes();

        let adjustedHour = h;
        if (h < 10) adjustedHour += 24;

        let idx = 0;
        if (adjustedHour >= 10 && adjustedHour <= 29) {
          idx = (adjustedHour - 10) * 12 + Math.floor(m / 5);
        } else {
          return; // 6〜9時は表示範囲外
        }

        const cellWidth = 20;
        const containerWidth = contentTimelineRef.current.clientWidth;
        const scrollPosition = idx * cellWidth - containerWidth / 2;

        contentTimelineRef.current.scrollLeft = Math.max(0, scrollPosition);
        if (headerTimelineRef.current) {
          headerTimelineRef.current.scrollLeft = Math.max(0, scrollPosition);
        }
      }
    }, 100);
  }, []);

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

  // Row height & Cell width adjustments for compact view
  const rowHeight = 76; // Row height with vertical breathing room
  const cellWidth = 20; // Cell width

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative z-0">
      <div className="flex w-full h-full">
        {/* Left Column (Therapists) */}
        <div style={{ width: 'fit-content', minWidth: 'fit-content' }} className="flex-shrink-0 border-r border-slate-200 bg-white z-20 flex flex-col relative">
          {/* Header (Date) */}
          <div style={{ height: '56px' }} className="border-b border-slate-200 flex flex-col justify-center items-center sticky top-0 bg-white/95 backdrop-blur z-30 px-3">
            <div className="font-bold text-slate-800 text-sm tracking-tight">
              {date ? (() => {
                const [year, month, day] = date.split('-').map(Number);
                const localDate = new Date(year, month - 1, day);
                return localDate.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
              })() : new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              勤務スケジュール
            </div>
            {/* Soft gradient separation line */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          </div>

          {/* Therapist List */}
          <div className="flex-1 overflow-y-hidden">
            {therapists.map((therapist) => {
              const hasAnyBlock = schedules.some(
                s => s.therapistId === therapist.id && s.type === 'blocked'
              );
              return (
                <div
                  key={therapist.id}
                  style={{ height: `${rowHeight}px` }}
                  className="flex items-stretch border-b border-slate-100 bg-white hover:bg-indigo-50/40 transition-colors group relative overflow-hidden"
                >
                  {/* Active indicator bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                  {/* 写真 — 3:4固定比率 */}
                  <div className="w-[42px] flex-shrink-0 self-center pl-1.5 py-1">
                    <div className="relative w-full overflow-hidden rounded bg-slate-100 flex items-center justify-center border border-slate-200" style={{ aspectRatio: '3/4' }}>
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
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p
                        className="text-[13px] font-bold text-slate-800 leading-none group-hover:text-indigo-700 transition-colors cursor-default truncate"
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
                      ) : therapist.shiftStart && therapist.shiftEnd ? (
                        <span className="text-emerald-600">{therapist.shiftStart}〜{therapist.shiftEnd}</span>
                      ) : (
                        <span className="text-slate-400">未設定</span>
                      )}
                    </p>

                    {/* ルーム + インターバル */}
                    <div className="flex items-center gap-1.5 flex-wrap">
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
                        onShiftEditOpen(therapist.id);
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
        </div>

        {/* Right timeline area */}
        <div
          className="flex-1 overflow-x-auto overflow-y-hidden select-none relative custom-scrollbar bg-slate-50"
          ref={contentTimelineRef}
          onScroll={handleTimelineScroll}
          onMouseDown={handleMouseDown}
          style={{ cursor: 'default' }}
        >
          {/* Header timeline */}
          <div
            className="flex relative sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm"
            style={{ minWidth: 'fit-content', height: '56px' }}
            ref={headerTimelineRef}
          >
            {hourLabels.map((label, idx) => (
              <div
                key={`hour-${idx}`}
                className="flex flex-col border-r border-slate-200"
                style={{ width: `${(cellWidth * 12)}px` }}
              >
                <div className="h-8 flex items-center px-2 text-xs font-bold text-slate-700 tracking-wide">
                  {label}
                </div>
                <div className="h-6 flex text-[9px] font-medium text-slate-400 border-t border-slate-100 bg-slate-100">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="flex-1 flex justify-center items-center border-r border-slate-100 last:border-0 relative">
                      {i === 0 || i === 6 ? (
                        <span>{String(i * 5).padStart(2, '0')}</span>
                      ) : (
                        <div className="w-[1px] h-1 bg-slate-200 rounded-full" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Seek Bar Header Marker */}
            {showSeek && seekIndex > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: `${seekIndex * cellWidth}px`,
                  top: '32px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'rgb(99 102 241)', // indigo-500
                  transform: 'translateX(-4px)',
                  boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.2)',
                  zIndex: 20,
                }}
              />
            )}
          </div>

          {/* Grid body */}
          <div className="relative" style={{ minWidth: 'fit-content' }}>
            {/* Seek Bar Line */}
            {showSeek && seekIndex > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: `${seekIndex * cellWidth}px`,
                  top: 0,
                  width: '2px',
                  height: `${therapists.length * rowHeight}px`,
                  background: 'linear-gradient(to bottom, rgb(99 102 241), rgba(99, 102, 241, 0.1))',
                  zIndex: 10,
                  pointerEvents: 'none'
                }}
              />
            )}

            <div className="grid gap-0" style={{
              gridTemplateColumns: `repeat(${timeSlots.length}, minmax(${cellWidth}px, 1fr))`,
              minWidth: 'fit-content',
            }}>
              {therapists.map((therapist, tIdx) =>
                timeSlots.map((timeSlot, idx) => {
                  const inShift = isCellInShift(therapist, idx);
                  const cellStyle = getCellBackgroundStyle(inShift);

                  const handleCellClick = () => {
                    if (isDragging || dragDistanceRef.current > 5) return;
                    if (!date || therapist.id === 'unassigned') return;
                    router.push(`/reservations/new?from=shifts&therapist_id=${therapist.id}&date=${date}&time=${timeSlot}`);
                  };

                  return (
                    <div
                      key={`${therapist.id}-${idx}`}
                      className={`border-r border-slate-100 ${tIdx < therapists.length - 1 ? 'border-b border-slate-100' : ''} ${therapist.id !== 'unassigned' ? 'hover:bg-indigo-50/50 transition-colors' : ''}`}
                      style={{ ...cellStyle, height: `${rowHeight}px`, cursor: therapist.id === 'unassigned' ? 'default' : 'pointer' }}
                      onClick={handleCellClick}
                      onMouseDown={() => { dragDistanceRef.current = 0; }}
                      onMouseEnter={(e) => {
                        if (isDragging || dragDistanceRef.current > 5 || therapist.id === 'unassigned') return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoverData({
                          x: rect.left + rect.width / 2,
                          y: rect.top, // Cell top
                          time: timeSlot
                        });
                      }}
                      onMouseLeave={() => setHoverData(null)}
                    >
                    </div>
                  );
                })
              )}
            </div>

            {/* Schedules Layer */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
              {schedules.map((schedule, idx) => {
                const therapistIndex = therapists.findIndex(t => t.id === schedule.therapistId);
                if (therapistIndex === -1) return null;

                const startMinutes = timeToMinutes(schedule.startTime);
                const endMinutes = timeToMinutes(schedule.endTime);
                const duration = endMinutes - startMinutes;

                const top = therapistIndex * rowHeight + 4; // Slight padding from top
                const height = rowHeight - 8; // Padding from bottom
                const startPixels = (startMinutes / 5) * cellWidth;
                const widthPixels = (duration / 5) * cellWidth;

                const handleScheduleClick = () => {
                  if (isDragging || dragDistanceRef.current > 5) return;
                  if (schedule.type === 'reservation' && schedule.reservationId) {
                    router.push(`/reservations/${schedule.reservationId}?from=shifts`);
                  }
                };

                const isReservation = schedule.type === 'reservation';
                const isInterval = schedule.type === 'interval';
                const isBlocked = schedule.type === 'blocked';
                const isUnhandledWeb = isReservation && schedule.source === 'web' && !schedule.isHandled;

                // 予約不可ブロック（えんじ色）
                if (isBlocked) {
                  return (
                    <div
                      key={`schedule-${idx}`}
                      className="absolute flex items-center justify-center overflow-hidden cursor-pointer"
                      style={{
                        top: `${top}px`,
                        left: `${startPixels + 2}px`,
                        width: `${widthPixels - 4}px`,
                        height: `${height}px`,
                        borderRadius: '10px',
                        background: 'repeating-linear-gradient(45deg, rgba(153,0,30,0.75), rgba(153,0,30,0.75) 5px, rgba(180,20,50,0.55) 5px, rgba(180,20,50,0.55) 10px)',
                        border: '1.5px solid rgba(120,0,20,0.9)',
                        pointerEvents: 'auto',
                      }}
                      title={`${schedule.startTime}～${schedule.endTime} 予約不可`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onBlockedClick && schedule.reservationId) {
                          onBlockedClick(schedule.reservationId, schedule.startTime, schedule.endTime);
                        }
                      }}
                    >
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: 'rgba(255,230,230,0.95)',
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.02em',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        padding: '0 6px',
                        textShadow: '0 1px 2px rgba(80,0,10,0.7)',
                      }}>
                        {schedule.startTime}～{schedule.endTime} 予約不可
                      </span>
                    </div>
                  );
                }

                // インターバルブロック
                if (isInterval) {
                  return (
                    <div
                      key={`schedule-${idx}`}
                      className="absolute pointer-events-none flex items-center justify-center overflow-hidden"
                      style={{
                        top: `${top}px`,
                        left: `${startPixels + 2}px`,
                        width: `${widthPixels - 4}px`,
                        height: `${height}px`,
                        borderRadius: '10px',
                        background: 'repeating-linear-gradient(45deg, rgba(107, 114, 128, 0.15), rgba(107, 114, 128, 0.15) 5px, rgba(156, 163, 175, 0.05) 5px, rgba(156, 163, 175, 0.05) 10px)',
                        border: '1.5px dashed rgba(75, 85, 99, 0.7)',
                      }}
                      title={schedule.title}
                    >
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        color: 'rgba(75, 85, 99, 0.9)',
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.02em',
                        padding: '0 4px',
                      }}>
                        INT
                      </span>
                    </div>
                  );
                }

                // 仮予約ブロック（Web予約・未確定）
                if (isReservation && schedule.isPending) {
                  return (
                    <div
                      key={`schedule-${idx}`}
                      className="absolute rounded-lg px-2 flex flex-col justify-center cursor-default pointer-events-auto transition-transform hover:-translate-y-0.5 hover:z-20"
                      style={{
                        top: `${top}px`,
                        left: `${startPixels + 2}px`,
                        width: `${widthPixels - 4}px`,
                        height: `${height}px`,
                        background: 'rgba(254,243,199,0.95)',
                        border: '2px dashed rgba(217,119,6,0.8)',
                        color: '#92400e',
                      }}
                      title={`${schedule.title} (${schedule.startTime} - ${schedule.endTime}) 仮予約`}
                      onClick={handleScheduleClick}
                    >
                      <div className="w-full h-full flex flex-col justify-between overflow-hidden py-1.5">
                        <div className="text-[10px] font-medium leading-none flex items-center gap-1">
                          <span className="whitespace-nowrap">{schedule.startTime}-{schedule.endTime}</span>
                          <span className="text-[9px] font-bold bg-amber-500 text-white px-1 rounded-sm">仮</span>
                        </div>
                        <div className="flex items-center justify-start gap-1 min-w-0">
                          <span className="font-bold text-[13px] leading-none truncate">
                            {schedule.customerName || schedule.title}
                          </span>
                          {schedule.paymentMethod === 'credit' && (
                            <span className="flex-shrink-0 text-[9px] px-1 rounded-sm font-bold bg-amber-500 text-white shadow-sm whitespace-nowrap">
                              💳 クレジット
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-medium flex items-center gap-1 leading-none flex-wrap">
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

                // 予約ブロック
                const isNotificationUnsent = isReservation && !schedule.isPending && (!schedule.customerNotified || !schedule.therapistNotified);
                const isWeb = schedule.source === 'web';
                const bgClasses = schedule.color
                  ? ''
                  : isReservation
                    ? schedule.isHime
                      ? isNotificationUnsent
                        ? 'bg-gradient-to-br from-[#e27396] to-[#c35175] border-2 border-amber-400 shadow-lg shadow-amber-500/40 animate-pulse-subtle'
                        : 'bg-gradient-to-br from-[#e27396] to-[#c35175] border border-[#c35175]/30 shadow-md shadow-rose-900/10'
                      : isWeb
                        ? isNotificationUnsent
                          ? 'bg-[#4d3c00] border-2 border-amber-400 shadow-lg shadow-amber-500/40 animate-pulse-subtle'
                          : 'bg-gradient-to-br from-teal-600 to-emerald-700 border border-teal-500/40 shadow-md shadow-teal-700/20'
                        : isNotificationUnsent
                          ? 'bg-[#4d3c00] border-2 border-amber-400 shadow-lg shadow-amber-500/40 animate-pulse-subtle'
                          : 'bg-gradient-to-br from-[#1f3c6d] to-[#0a1b3a] border border-[#0a1b3a]/40 shadow-md shadow-[#0a1b3a]/20'
                    : 'bg-gradient-to-br from-slate-600 to-slate-700 border border-slate-500 shadow-md shadow-slate-900/20';

                return (
                  <div
                    key={`schedule-${idx}`}
                    className={`absolute rounded-lg px-2 flex flex-col justify-center cursor-default pointer-events-auto transition-transform hover:-translate-y-0.5 hover:z-20 hover:shadow-lg ${bgClasses}`}
                    style={{
                      top: `${top}px`,
                      left: `${startPixels + 2}px`,  // +2 for slight visual separation from border
                      width: `${widthPixels - 4}px`, // -4 to not touch borders
                      height: `${height}px`,
                      ...(schedule.color ? { backgroundColor: schedule.color, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid rgba(0,0,0,0.1)' } : {}),
                      color: 'white',
                    }}
                    title={`${schedule.title} (${schedule.startTime} - ${schedule.endTime})`}
                    onClick={handleScheduleClick}
                  >
                    {/* Inner content wrapper to handle overflow nicely */}
                    <div className="w-full h-full flex flex-col justify-between overflow-hidden py-1.5">
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
                          <span className="bg-amber-500/90 text-white px-1 rounded-sm text-[9px] font-bold border border-amber-400/40">
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

      {/* Hover Popup */}
      {hoverData && (
        <div
          className="fixed pointer-events-none z-50 bg-slate-800 text-white font-bold text-xs rounded shadow-lg px-2.5 py-1.5 whitespace-nowrap transform -translate-x-1/2 -translate-y-full transition-opacity duration-75"
          style={{ top: hoverData.y - 4, left: hoverData.x }}
        >
          {hoverData.time}
          {/* Default Tailwind small arrow base on bottom */}
          <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full w-0 h-0 border-l-[4px] border-l-transparent border-t-[4px] border-t-slate-800 border-r-[4px] border-r-transparent"></div>
        </div>
      )}

      {/* Custom Scrollbar Styles for the timeline */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar {
          height: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f8fafc;
          border-radius: 0 0 16px 0;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 5px;
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

      {/* セラピスト情報ポップアップ */}
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

      {/* ルームメモポップアップ */}
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

      {/* 未解決メモポップアップ */}
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
    </div>
  );
};

export default TimeChart;


