'use client';

import React, { useMemo, useRef } from 'react';

interface Therapist {
  id: string;
  name: string;
  avatar?: string;
  shiftStart?: string; // "HH:mm" format
  shiftEnd?: string; // "HH:mm" format
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

  // スクロール同期ハンドラー
  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    
    // ヘッダーの時間軸をスクロール
    if (headerTimelineRef.current) {
      headerTimelineRef.current.scrollLeft = scrollLeft;
    }
  };
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
        {/* 左上の固定エリア */}
        <div className="w-48 flex-shrink-0 border-r border-gray-300 bg-gray-50">
          <div className="h-20 flex items-center justify-center font-semibold text-sm text-gray-700 border-b border-gray-300">
            セラピスト・出勤時間
          </div>
        </div>

        {/* 時間軸 */}
        <div className="flex-1 overflow-x-auto" ref={headerTimelineRef}>
          {/* 上段：時間ラベル */}
          <div className="grid gap-0" style={{
            gridTemplateColumns: `repeat(${timeSlots.length}, minmax(30px, 1fr))`,
            minWidth: 'fit-content',
          }}>
            {timeSlots.map((time, idx) => {
              // 1時間ごと（12セル = 60分 ÷ 5分）にラベルを表示
              const isHourStart = idx % 12 === 0;
              const hourLabelIndex = Math.floor(idx / 12);
              const label = isHourStart ? hourLabels[hourLabelIndex] : '';

              return (
                <div
                  key={`hour-label-${idx}`}
                  className={`h-10 flex items-center justify-center text-xs bg-gray-50 border-r border-gray-300 ${
                    isHourStart
                      ? 'text-sm font-bold text-gray-800 border-r-2 border-gray-400'
                      : 'text-gray-300'
                  }`}
                >
                  {label}
                </div>
              );
            })}
          </div>

          {/* 下段：分刻み */}
          <div className="grid gap-0" style={{
            gridTemplateColumns: `repeat(${timeSlots.length}, minmax(30px, 1fr))`,
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
              </div>
            </div>
          ))}
        </div>

        {/* タイムライン領域（横スクロール可能） */}
        <div 
          className="flex-1 overflow-x-auto overflow-y-auto"
          ref={contentTimelineRef}
          onScroll={handleTimelineScroll}
        >
          <div className="grid gap-0" style={{
            gridTemplateColumns: `repeat(${timeSlots.length}, minmax(30px, 1fr))`,
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

          {/* スケジュールをオーバーレイ */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {schedules.map((schedule, idx) => {
              const therapistIndex = therapists.findIndex(
                (t) => t.id === schedule.therapistId
              );
              if (therapistIndex === -1) return null;

              const style = getScheduleStyle(schedule);
              const topOffset = therapistIndex * 80 + 48; // 48px はヘッダーの高さ

              return (
                <div
                  key={idx}
                  className="absolute pointer-events-auto rounded px-2 py-1 text-xs font-medium text-white overflow-hidden"
                  style={{
                    ...style,
                    top: `${topOffset}px`,
                    height: '80px',
                    backgroundColor: schedule.color || '#3B82F6',
                    left: '192px', // セラピストリストの幅（w-48 = 192px）
                  }}
                >
                  <div className="truncate">{schedule.title}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeChart;
