'use client';

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Therapist {
  id: string;
  name: string;
  avatar?: string;
  shiftStart?: string; // "HH:mm" format
  shiftEnd?: string; // "HH:mm" format
  room?: string; // ルーム名
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

interface TimeChartProps {
  therapists: Therapist[];
  schedules?: Schedule[];
  date?: string; // YYYY-MM-DD format
  onBlockedClick?: (id: string, startTime: string, endTime: string) => void;
}

const TimeChart: React.FC<TimeChartProps> = ({
  therapists,
  schedules = [],
  date,
  onBlockedClick,
}) => {
  const router = useRouter();

  // スクロール同期用のref
  const headerTimelineRef = useRef<HTMLDivElement>(null);
  const contentTimelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartScrollLeft, setDragStartScrollLeft] = useState(0);
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
      setTimeout(() => setIsDragging(false), 50); // slight delay to prevent click fire
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
    for (let hour = 0; hour <= 5; hour++) {
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
    for (let hour = 0; hour <= 5; hour++) {
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
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentMinutesFromStart = currentHour * 60 + currentMinute - 10 * 60;

        if (currentMinutesFromStart < 0 || currentMinutesFromStart > 19 * 60) {
          return;
        }

        // Adjust for new cell width
        const scrollPosition = (currentMinutesFromStart / 5) * 20 - 100;
        if (scrollPosition > 0) {
          contentTimelineRef.current.scrollLeft = scrollPosition;
          if (headerTimelineRef.current) {
            headerTimelineRef.current.scrollLeft = scrollPosition;
          }
        }
      }
    }, 100);
  }, []);

  const now = new Date();
  const nowHour = now.getHours();
  const nowMin = now.getMinutes();
  let showSeek = false;
  let seekIndex = 0;
  if ((nowHour >= 10 && nowHour <= 23) || (nowHour >= 0 && nowHour <= 5)) {
    showSeek = true;
    if (nowHour >= 10) {
      seekIndex = (nowHour - 10) * 12 + Math.floor(nowMin / 5);
    } else {
      seekIndex = (14 * 12) + nowHour * 12 + Math.floor(nowMin / 5);
    }
  }

  // Row height & Cell width adjustments for compact view
  const rowHeight = 72; // Row height with vertical breathing room
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
            {therapists.map((therapist) => (
              <div
                key={therapist.id}
                style={{ height: `${rowHeight}px` }}
                className="flex items-center gap-1 px-1 border-b border-slate-100 bg-white hover:bg-indigo-50/40 transition-colors group relative overflow-hidden"
              >
                {/* Active indicator bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                {therapist.avatar ? (
                  <img
                    src={therapist.avatar}
                    alt={therapist.name}
                    className="w-8 h-8 rounded-full object-cover shadow-sm ring-2 ring-white flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-500 flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white flex-shrink-0">
                    {therapist.name.charAt(0)}
                  </div>
                )}
                <div className="flex flex-col justify-center gap-1">
                  <p className="text-xs font-bold text-slate-800 whitespace-nowrap leading-none group-hover:text-indigo-700 transition-colors">
                    {therapist.name}
                  </p>
                  <span className="text-[9px] font-medium px-1 leading-none rounded bg-slate-100 text-slate-500 border border-slate-200 self-start">
                    {therapist.intervalMinutes && therapist.intervalMinutes > 0 ? `${therapist.intervalMinutes}分` : '20分'}
                  </span>
                  <p className="text-[10px] font-medium whitespace-nowrap leading-none">
                    {therapist.shiftStart && therapist.shiftEnd ? (
                      <span className="text-emerald-700 bg-emerald-50 px-1.5 rounded border border-emerald-100">
                        {therapist.shiftStart} - {therapist.shiftEnd}
                      </span>
                    ) : (
                      <span className="text-slate-500 bg-slate-50 px-1.5 rounded border border-slate-100">シフト未設定</span>
                    )}
                  </p>
                  {therapist.room && (
                    <p className="text-[9px] text-slate-500 whitespace-nowrap leading-none flex items-center gap-0.5 font-medium">
                      <svg className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                      {therapist.room}
                    </p>
                  )}
                </div>
              </div>
            ))}
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
                    if (!date) return;
                    router.push(`/reservations/new?from=shifts&therapist_id=${therapist.id}&date=${date}&time=${timeSlot}`);
                  };

                  return (
                    <div
                      key={`${therapist.id}-${idx}`}
                      className={`border-r border-slate-100 ${tIdx < therapists.length - 1 ? 'border-b border-slate-100' : ''} hover:bg-indigo-50/50 transition-colors`}
                      style={{ ...cellStyle, height: `${rowHeight}px` }}
                      onClick={handleCellClick}
                      onMouseDown={() => { dragDistanceRef.current = 0; }}
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

                // 予約不可ブロック（グレー実線箇）
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
                        background: 'repeating-linear-gradient(45deg, rgba(100,116,139,0.22), rgba(100,116,139,0.22) 5px, rgba(100,116,139,0.08) 5px, rgba(100,116,139,0.08) 10px)',
                        border: '1.5px dashed rgba(100,116,139,0.7)',
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
                        color: 'rgba(71,85,105,0.85)',
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.02em',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        padding: '0 6px',
                      }}>
                        {schedule.startTime}～{schedule.endTime} 予約不可
                      </span>
                    </div>
                  );
                }

                // インターバルブロック（アンバー色ストライプ）
                if (isInterval) {
                  return (
                    <div
                      key={`schedule-${idx}`}
                      className="absolute pointer-events-none"
                      style={{
                        top: `${top}px`,
                        left: `${startPixels + 2}px`,
                        width: `${widthPixels - 4}px`,
                        height: `${height}px`,
                        borderRadius: '10px',
                        background: 'repeating-linear-gradient(45deg, rgba(148,163,184,0.18), rgba(148,163,184,0.18) 5px, rgba(148,163,184,0.07) 5px, rgba(148,163,184,0.07) 10px)',
                        border: '1.5px dashed rgba(148,163,184,0.6)',
                      }}
                      title={schedule.title}
                    />
                  );
                }

                // 予約ブロック
                const bgClasses = schedule.color
                  ? ''
                  : isReservation
                    ? 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 border border-indigo-400/50 shadow-md shadow-indigo-500/20'
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
                    <div className="w-full h-full flex flex-col justify-center overflow-hidden gap-0.5">
                      {/* Row 1: Time */}
                      <div className="text-[9px] font-medium text-white leading-none">
                        <span className="whitespace-nowrap">{schedule.startTime}-{schedule.endTime}</span>
                      </div>

                      {/* Row 2: Name and New/Member */}
                      <div className="flex items-center justify-start gap-1 min-w-0">
                        <span className="font-bold text-[11px] text-white leading-none truncate drop-shadow-sm">
                          {schedule.customerName || schedule.title}
                        </span>
                        {isReservation && (
                          <span className={`flex-shrink-0 text-[8px] px-1 rounded-sm font-bold ${schedule.isNewCustomer ? 'bg-rose-400/90' : 'bg-emerald-400/90'} text-white shadow-sm`}>
                            {schedule.isNewCustomer ? '新規' : '会員'}
                          </span>
                        )}
                      </div>

                      {/* Row 3: Duration, Designation and Price */}
                      <div className="text-[9px] font-medium text-white flex items-center gap-1 leading-none">
                        {schedule.courseDuration && (
                          <span className="opacity-90">{schedule.courseDuration}分</span>
                        )}
                        {schedule.designationLabel && (
                          <span className="bg-white/20 px-1 rounded-sm text-[8px] text-white border border-white/10">{schedule.designationLabel}</span>
                        )}
                        {isReservation && schedule.totalPrice !== undefined && (
                          <span className="text-[10px] font-extrabold text-white bg-black/15 px-1 py-0 rounded backdrop-blur-[1px]">
                            ¥{schedule.totalPrice.toLocaleString()}
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
      `}} />
    </div>
  );
};

export default TimeChart;


