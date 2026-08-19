'use client';

// 日付タブの選択状態を持つため、クライアントコンポーネントとして扱う。
// （呼び出し元のページがサーバーコンポーネント化されたため明示が必要）
import React, { useState } from 'react';
import { Therapist, ConfirmedShift } from '../../types/store';
import { TherapistCard } from './TherapistCard';

interface WeeklyScheduleProps {
  therapists: Therapist[];
  confirmedShifts?: ConfirmedShift[];
  storeSlug: string;
  basePath?: string;
  /** 店舗の営業日切り替え時刻(JST)を考慮した「本日の営業日」文字列 (YYYY-MM-DD)。
   *  未指定の場合はブラウザのローカル日付にフォールバックする。 */
  businessTodayStr?: string;
}

export const WeeklySchedule: React.FC<WeeklyScheduleProps> = ({
  therapists,
  confirmedShifts = [],
  storeSlug,
  basePath,
  businessTodayStr,
}) => {
  const isCyber = storeSlug === 'onyankospa';
  const isLuxury = storeSlug === 'specialgrade';

  // 起点日（店舗の営業日切り替え時刻を考慮した「本日」）
  const startDate = businessTodayStr ? new Date(`${businessTodayStr}T00:00:00`) : new Date();

  // 向こう7日分の日付オブジェクトを生成
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dateStr = String(d.getDate()).padStart(2, '0');
    const fullDate = `${year}-${month}-${dateStr}`;
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    return {
      fullDate,
      month: d.getMonth() + 1,
      dateNum: d.getDate(),
      dayOfWeek,
      label: `${d.getMonth() + 1}/${d.getDate()}(${dayOfWeek})`,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: i === 0,
    };
  });

  const [selectedDate, setSelectedDate] = useState<string>(days[0].fullDate);

  // (therapistId, fullDate) => ConfirmedShift Map
  const shiftMap = new Map<string, ConfirmedShift>();
  confirmedShifts.forEach((s) => {
    shiftMap.set(`${s.therapistId}_${s.date}`, s);
  });

  // 選択された日付の出勤セラピストとシフト時間のリストを抽出
  const selectedDayObj = days.find((d) => d.fullDate === selectedDate) || days[0];

  const workingTherapistsWithShift = therapists
    .map((th) => {
      const shift = shiftMap.get(`${th.id}_${selectedDate}`);

      return {
        therapist: th,
        shiftTime: shift ? `${shift.startTime}~${shift.endTime}` : null,
        startTime: shift ? shift.startTime : null,
      };
    })
    .filter((item) => item.shiftTime !== null)
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));

  return (
    <div className="space-y-6">
      {/* 日付切り替えタブバー (1画面7列収容) */}
      <div className="w-full">
        <div className="grid grid-cols-7 gap-1 sm:gap-2 w-full">
          {days.map((day) => {
            const isSelected = selectedDate === day.fullDate;
            const isSun = day.dayOfWeek === '日';
            const isSat = day.dayOfWeek === '土';

            return (
              <button
                key={day.fullDate}
                onClick={() => setSelectedDate(day.fullDate)}
                className={`flex flex-col items-center justify-center py-2 px-0.5 sm:px-2 rounded-xl sm:rounded-2xl text-center transition-all border w-full min-w-0 ${
                  isSelected
                    ? isCyber
                      ? 'bg-gradient-to-b from-[#ff6fb5] to-[#e04899] text-white border-[#ff6fb5] shadow-[0_0_14px_rgba(255,111,181,0.7)] scale-[1.02] z-10'
                      : isLuxury
                      ? 'bg-gradient-to-r from-[#d4af37] to-[#e2b3b1] text-white border-transparent shadow-md scale-[1.02] z-10'
                      : 'bg-[#a39573] text-white border-[#a39573] shadow-md scale-[1.02] z-10'
                    : isCyber
                    ? 'bg-white/90 backdrop-blur-md text-slate-900 border-[#ff6fb5]/40 hover:border-[#ff6fb5] hover:bg-white shadow-sm'
                    : isLuxury
                    ? 'bg-[#fdf8f5]/95 backdrop-blur-md text-[#2b2827] border-[#e2b3b1]/40 hover:border-[#c5a059] hover:bg-white shadow-2xs'
                    : 'bg-white/90 backdrop-blur-md text-stone-800 border-stone-200 hover:bg-white'
                }`}
              >
                <span
                  className={`text-[9px] sm:text-[11px] font-extrabold leading-tight ${
                    isSelected
                      ? 'text-white'
                      : day.isToday
                      ? isCyber ? 'text-[#ff4fa3]' : isLuxury ? 'text-[#c5a059]' : 'text-[#a39573]'
                      : isSun
                      ? 'text-rose-500'
                      : isSat
                      ? 'text-sky-500'
                      : isLuxury ? 'text-[#5c5250]' : 'text-slate-600'
                  }`}
                >
                  {day.isToday ? '本日' : `(${day.dayOfWeek})`}
                </span>
                <span
                  className={`text-xs sm:text-base font-extrabold tracking-tight leading-tight mt-0.5 whitespace-nowrap ${
                    isSelected ? 'text-white' : isLuxury ? 'text-[#2b2827]' : 'text-slate-900'
                  }`}
                >
                  {day.dateNum}日
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 選択日付タイトル */}
      <div className={`flex items-center justify-between border-b pb-3 px-1 ${
        isCyber ? 'border-[#ff6fb5]/30' : isLuxury ? 'border-[#e2b3b1]/35' : 'border-stone-200'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isCyber ? 'bg-[#ff6fb5] animate-ping' : isLuxury ? 'bg-[#c5a059]' : 'bg-[#a39573]'}`} />
          <h3 className={`text-base sm:text-lg tracking-wider ${
            isCyber ? 'neon-text-pink font-bold' : isLuxury ? 'font-luxury-display font-medium text-[#2b2827]' : 'text-stone-800 font-bold'
          }`}>
            {selectedDayObj.label} の出勤セラピスト
          </h3>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
          isCyber
            ? 'bg-[#ff6fb5]/20 text-[#c4b2dc] border border-[#ff6fb5]/40'
            : isLuxury
            ? 'bg-[#fdf8f5] text-[#c5a059] border border-[#e2b3b1]/40 font-luxury-display'
            : 'bg-stone-100 text-stone-600'
        }`}>
          計 {workingTherapistsWithShift.length} 名出勤
        </span>
      </div>

      {/* 出勤セラピスト 2列グリッド表示 */}
      {workingTherapistsWithShift.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {workingTherapistsWithShift.map(({ therapist, shiftTime }, idx) => (
            <TherapistCard
              key={therapist.id}
              therapist={therapist}
              storeSlug={storeSlug}
              basePath={basePath}
              confirmedShiftTime={shiftTime || undefined}
              index={idx}
            />
          ))}
        </div>
      ) : (
        <div className={`text-center py-16 rounded-2xl border ${
          isCyber
            ? 'bg-white/8 border-[#ff6fb5]/20 text-[#ffa8d8]'
            : isLuxury
            ? 'bg-white/80 border-[#e2b3b1]/30 text-[#8a7e7c]'
            : 'bg-white border-stone-200 text-stone-500'
        }`}>
          <p className="text-sm font-semibold">
            {isLuxury ? 'ご指定の日時の出勤スケジュールは現在調整中です' : '指定のお日付の出勤スケジュールは準備中です 🐾'}
          </p>
        </div>
      )}
    </div>
  );
};
