'use client';

import React, { useMemo, useRef, useState } from 'react';

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
}

interface TimeChartProps {
  therapists: Therapist[];
  schedules?: Schedule[];
}

const TimeChart: React.FC<TimeChartProps> = ({
  therapists,
  schedules = [],
}) => {
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

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-md overflow-hidden">
      {/* ヘッダー */}
      <div className="flex">
        {/* 時間軸 */}
        <div className="flex-1 overflow-x-auto" ref={headerTimelineRef} onScroll={handleHeaderScroll}>
          {/* 上段：時間ラベル（1時間ごと） */}
          <div className="flex gap-0" style={{
            minWidth: 'fit-content',
          }}>
            {hourLabels.map((label, idx) => (
              <div
                key={`hour-${idx}`}
                className="h-10 flex items-center justify-center text-sm font-bold text-gray-800 bg-gray-50 border-r-2 border-gray-400"
                style={{
                  width: `${(20 * 12)}px`, // 5分セル（20px）× 12セル = 1時間
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* 下段：分刻み */}
          <div className="grid gap-0" style={{
            gridTemplateColumns: `repeat(${timeSlots.length}, minmax(20px, 1fr))`,
            minWidth: 'fit-content',
          }}>
            {timeSlots.map((time, idx) => {
              // 5分ごとに分を表示
              const minutes = (idx * 5) % 60;
              const displayMin = String(minutes).padStart(2, '0');

              return (
                <div
                  key={idx}
                  className="h-10 flex items-center justify-center text-xs text-gray-500 border-r border-gray-200 bg-gray-50 border-b border-gray-300"
                >
                  {displayMin}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左側のセラピストリスト（固定） */}
        <div className="w-48 flex-shrink-0 border-r border-gray-300 overflow-y-auto">
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

        {/* タイムライン領域（横スクロール可能） */}
        <div 
          className="flex-1 overflow-x-auto overflow-y-auto select-none"
          ref={contentTimelineRef}
          onScroll={handleTimelineScroll}
          onMouseDown={handleMouseDown}
        >
          <div className="grid gap-0" style={{
            gridTemplateColumns: `repeat(${timeSlots.length}, minmax(20px, 1fr))`,
            minWidth: 'fit-content',
          }}>
            {/* タイムグリッドの背景線 */}
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
        </div>
      </div>
    </div>
  );
};

export default TimeChart;
