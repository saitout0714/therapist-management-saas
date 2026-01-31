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
}

interface Schedule {
  therapistId: string;
  startTime: string; // "HH:mm" format
  endTime: string;
  title: string;
  color?: string;
  type?: 'shift' | 'reservation';
  reservationId?: string;
  customerId?: string;
  customerName?: string;
}

interface TimeChartProps {
  therapists: Therapist[];
  schedules?: Schedule[];
  date?: string; // YYYY-MM-DD format
}

const TimeChart: React.FC<TimeChartProps> = ({
  therapists,
  schedules = [],
  date,
}) => {
  const router = useRouter();
  
  // スクロール同期用のref
  const headerTimelineRef = useRef<HTMLDivElement>(null);
  const contentTimelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartScrollLeft, setDragStartScrollLeft] = useState(0);

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

    // ドラッグ中のマウスムーブを処理
    const handleDragMove = (moveEvent: MouseEvent) => {
      if (!contentTimelineRef.current) return;

      const deltaX = moveEvent.clientX - startClientX;
      const newScrollLeft = startScrollLeft - deltaX;
      
      contentTimelineRef.current.scrollLeft = newScrollLeft;
      if (headerTimelineRef.current) {
        headerTimelineRef.current.scrollLeft = newScrollLeft;
      }
    };

    // ドラッグ終了
    const handleDragEnd = () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };

  // ドラッグ中のスクロール（削除）
  // const handleMouseMove は不要になります

  // ドラッグ終了（削除）
  // const handleMouseUp は document リスナーで処理します
  // 10:00から翌日5:00までの時間生成（5分間隔）
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 10; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 5) {
        slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
      }
    }
    // 翌日 0:00 ~ 5:00
    for (let hour = 0; hour <= 5; hour++) {
      for (let minute = 0; minute < 60; minute += 5) {
        slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
      }
    }
    return slots;
  }, []);

  // 1時間ごとの時刻ラベルを生成
  const hourLabels = useMemo(() => {
    const labels = [];
    for (let hour = 10; hour < 24; hour++) {
      labels.push(`${String(hour).padStart(2, '0')}時`);
    }
    // 翌日 0:00 ~ 5:00
    for (let hour = 0; hour <= 5; hour++) {
      labels.push(`${String(hour).padStart(2, '0')}時`);
    }
    return labels;
  }, []);

  // 時刻を分単位に変換
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (hours >= 10) {
      return (hours - 10) * 60 + minutes;
    } else {
      // 翌日の場合（0:00～5:00）
      return (24 - 10) * 60 + hours * 60 + minutes;
    }
  };

  // セルがシフト時間内かどうかを判定
  const isCellInShift = (therapist: Therapist, timeSlotIndex: number): boolean => {
    if (!therapist.shiftStart || !therapist.shiftEnd) {
      return true; // シフト情報がない場合は勤務時間とみなす
    }

    const shiftStartMinutes = timeToMinutes(therapist.shiftStart);
    const shiftEndMinutes = timeToMinutes(therapist.shiftEnd);
    const cellTimeMinutes = timeSlotIndex * 5; // 5分間隔に変更

    // シフト終了時刻が開始時刻より小さい場合（例：22:00～3:00）
    if (shiftEndMinutes < shiftStartMinutes) {
      return cellTimeMinutes >= shiftStartMinutes || cellTimeMinutes < shiftEndMinutes;
    } else {
      return cellTimeMinutes >= shiftStartMinutes && cellTimeMinutes < shiftEndMinutes;
    }
  };

  // セルのバックグラウンドスタイルを取得
  const getCellBackgroundStyle = (isInShift: boolean) => {
    if (isInShift) {
      return {
        backgroundColor: '#FFFFFF',
      };
    } else {
      return {
        backgroundImage: 'repeating-linear-gradient(45deg, #D1D5DB, #D1D5DB 10px, #E5E7EB 10px, #E5E7EB 20px)',
        backgroundColor: '#E5E7EB',
      };
    }
  };

  // マウント時に現在時刻の位置までスクロール
  useEffect(() => {
    setTimeout(() => {
      if (contentTimelineRef.current) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentMinutesFromStart = currentHour * 60 + currentMinute - 10 * 60; // 10:00からの分数
        
        // 10:00より前または5:00より後の場合はスクロールしない
        if (currentMinutesFromStart < 0 || currentMinutesFromStart > 19 * 60) {
          return;
        }
        
        // 各セルが20px、5分間隔なので1分=4px
        const scrollPosition = (currentMinutesFromStart / 5) * 20 - 100; // 100px は見栄え調整
        if (scrollPosition > 0) {
          contentTimelineRef.current.scrollLeft = scrollPosition;
          if (headerTimelineRef.current) {
            headerTimelineRef.current.scrollLeft = scrollPosition;
          }
        }
      }
    }, 100);
  }, []);

  // スケジュールの開始位置と幅を計算
  const getScheduleStyle = (schedule: Schedule) => {
    const startMinutes = timeToMinutes(schedule.startTime);
    const endMinutes = timeToMinutes(schedule.endTime);
    const duration = endMinutes - startMinutes;
    
    // 1つのセルが5分、grid templateでの位置を計算
    const startCol = Math.floor(startMinutes / 5) + 1; // +1 は時刻ラベル分
    const colSpan = Math.ceil(duration / 5);
    
    return {
      gridColumn: `${startCol} / span ${colSpan}`,
    };
  };

  // 現在時刻のシークバー位置を計算
  const now = new Date();
  const nowHour = now.getHours();
  const nowMin = now.getMinutes();
  // 10:00～翌5:00の範囲内のみ表示
  let showSeek = false;
  let seekIndex = 0;
  if ((nowHour >= 10 && nowHour <= 23) || (nowHour >= 0 && nowHour <= 5)) {
    showSeek = true;
    if (nowHour >= 10) {
      seekIndex = (nowHour - 10) * 12 + Math.floor(nowMin / 5);
    } else {
      seekIndex = (14 * 12) + nowHour * 12 + Math.floor(nowMin / 5); // 14時間分+深夜
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-md overflow-hidden">
      {/* ヘッダー */}
      {/* 新レイアウト: 左カラムとタイムラインをflexで並列配置 */}
      <div className="flex w-full">
        {/* 左側の固定カラム（日付＋セラピスト名） */}
        <div style={{ width: '12rem', minWidth: '12rem', maxWidth: '12rem' }} className="flex-shrink-0 border-r border-gray-300 bg-white z-20">
          {/* 日付セル */}
          <div style={{ height: '80px' }} className="border-b-2 border-gray-300 flex flex-col sticky top-0 z-20">
            <div className="h-10 flex items-center justify-center text-base font-bold text-gray-800">
              {date ? (() => {
                const [year, month, day] = date.split('-').map(Number);
                const localDate = new Date(year, month - 1, day);
                return localDate.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
              })() : new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })}
            </div>
            <div className="h-10 flex items-center justify-center text-xs text-gray-500 border-t border-gray-200">
              {/* 空白 */}
            </div>
          </div>
          {/* セラピストリスト */}
          {therapists.map((therapist) => (
            <div
              key={therapist.id}
              className="h-20 flex items-center gap-3 px-3 py-4 border-b border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            >
              {therapist.avatar ? (
                <img
                  src={therapist.avatar}
                  alt={therapist.name}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-300 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">
                  {therapist.name}
                </p>
                <p className="text-xs text-gray-600 truncate">
                  {therapist.shiftStart && therapist.shiftEnd ? (
                    <span className="font-semibold text-blue-600">
                      {therapist.shiftStart} - {therapist.shiftEnd}
                    </span>
                  ) : (
                    <span className="text-gray-400">シフトなし</span>
                  )}
                </p>
                {therapist.room && (
                  <p className="text-xs text-gray-500 truncate">
                    {therapist.room}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        {/* 右側：タイムライン部分（横スクロール） */}
           <div className="flex-1 overflow-x-auto overflow-y-hidden select-none relative"
             ref={contentTimelineRef}
             onScroll={handleTimelineScroll}
             onMouseDown={handleMouseDown}>
          {/* 時間ラベル行 */}
          <div className="flex gap-0 relative" style={{ minWidth: 'fit-content' }}>
            {hourLabels.map((label, idx) => (
              <div
                key={`hour-${idx}`}
                className="flex flex-col border-r-2 border-gray-400 bg-gray-50"
                style={{ width: `${(20 * 12)}px`, height: '80px' }}
              >
                <div className="h-10 flex items-center justify-center text-sm font-bold text-gray-800">
                  {label}
                </div>
                <div className="h-10 flex items-center justify-center text-xs text-gray-500 border-t border-gray-200">
                  {/* 5分ラベルを12個表示 */}
                  {Array.from({ length: 12 }).map((_, i) => (
                    <span key={i} style={{ width: 20, display: 'inline-block', textAlign: 'center' }}>
                      {String(i * 5).padStart(2, '0')}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {/* シークバー（全体に伸びる） */}
            {showSeek && seekIndex > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: `${seekIndex * 20}px`,
                  top: 0,
                  width: '2px',
                  height: `${80 + therapists.length * 80}px`,
                  background: 'blue',
                  zIndex: 10,
                }}
              />
            )}
          </div>
          {/* タイムグリッド本体（セラピストごとに行） */}
          <div className="relative" style={{
            minWidth: 'fit-content',
          }}>
            {/* タイムグリッドの背景 */}
            <div className="grid gap-0" style={{
              gridTemplateColumns: `repeat(${timeSlots.length}, minmax(20px, 1fr))`,
              minWidth: 'fit-content',
            }}>
              {therapists.map((therapist) =>
                timeSlots.map((_, idx) => {
                  const inShift = isCellInShift(therapist, idx);
                  const cellStyle = getCellBackgroundStyle(inShift);
                  return (
                    <div
                      key={`${therapist.id}-${idx}`}
                      className="h-20 border-r border-gray-200 border-b border-gray-100 hover:opacity-80 transition-opacity"
                      style={cellStyle}
                    />
                  );
                })
              )}
            </div>
            
            {/* スケジュール要素（シフトと予約） */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
              {schedules.map((schedule, idx) => {
                // デバッグログ
                if (idx === 0) {
                  console.log('=== TimeChart Debug Info ===');
                  console.log('Therapists in TimeChart:');
                  therapists.forEach((t, i) => {
                    console.log(`  [${i}] id: ${t.id}, name: ${t.name}`);
                  });
                }
                
                const therapistIndex = therapists.findIndex(t => t.id === schedule.therapistId);
                
                if (idx === 0) {
                  console.log('Looking for therapistId:', schedule.therapistId);
                  console.log('Found at index:', therapistIndex);
                  console.log('Calculated top position:', 80 + therapistIndex * 80, 'px');
                  console.log('Expected therapist:', therapists[therapistIndex]?.name);
                }
                
                if (therapistIndex === -1) {
                  console.warn('Therapist not found for:', schedule.therapistId);
                  return null;
                }

                const startMinutes = timeToMinutes(schedule.startTime);
                const endMinutes = timeToMinutes(schedule.endTime);
                const duration = endMinutes - startMinutes;

                const top = therapistIndex * 80;  // ヘッダーは別要素なので加算不要
                const startPixels = (startMinutes / 5) * 20;
                const widthPixels = (duration / 5) * 20;

                const handleScheduleClick = () => {
                  if (schedule.type === 'reservation' && schedule.reservationId) {
                    router.push(`/reservations/${schedule.reservationId}/edit?from=shifts`);
                  }
                };

                return (
                  <div
                    key={`schedule-${idx}`}
                    style={{
                      position: 'absolute',
                      top: `${top}px`,
                      left: `${startPixels}px`,
                      width: `${widthPixels}px`,
                      height: '80px',
                      backgroundColor: schedule.color || '#3B82F6',
                      border: `2px solid ${schedule.type === 'reservation' ? '#059669' : '#1E40AF'}`,
                      borderRadius: '4px',
                      padding: '4px',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      pointerEvents: 'auto',
                      opacity: 0.9,
                    }}
                    className="hover:opacity-100 transition-opacity"
                    title={`${schedule.title} (${schedule.startTime} - ${schedule.endTime})`}
                    onClick={handleScheduleClick}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {schedule.type === 'reservation' ? '予' : 'S'}
                    </div>
                    <div style={{ fontSize: '10px', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {schedule.title}
                    </div>
                    <div style={{ fontSize: '9px', color: 'white', marginTop: '2px' }}>
                      {schedule.startTime}-{schedule.endTime}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default TimeChart;
