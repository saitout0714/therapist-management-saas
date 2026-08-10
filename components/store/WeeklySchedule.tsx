import React, { useState } from 'react';
import { Therapist, ConfirmedShift } from '../../types/store';
import { TherapistCard } from './TherapistCard';

interface WeeklyScheduleProps {
  therapists: Therapist[];
  confirmedShifts?: ConfirmedShift[];
  storeSlug: string;
}

export const WeeklySchedule: React.FC<WeeklyScheduleProps> = ({
  therapists,
  confirmedShifts = [],
  storeSlug,
}) => {
  const isCyber = storeSlug === 'onyankospa';

  // 向こう7日分の日付オブジェクトを生成
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
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

  const hasRealShifts = confirmedShifts.length > 0;

  // 選択された日付の出勤セラピストとシフト時間のリストを抽出
  const selectedDayIndex = days.findIndex((d) => d.fullDate === selectedDate);
  const selectedDayObj = days.find((d) => d.fullDate === selectedDate) || days[0];

  const workingTherapistsWithShift = therapists
    .map((th) => {
      const shift = shiftMap.get(`${th.id}_${selectedDate}`);
      const isWorkingFallback =
        !hasRealShifts &&
        ((th.id.charCodeAt(th.id.length - 1) + (selectedDayIndex >= 0 ? selectedDayIndex : 0)) % 2 === 0 ||
          selectedDayObj.isToday);

      const shiftTime = shift
        ? `${shift.startTime}~${shift.endTime}`
        : isWorkingFallback
        ? '13:00~22:00'
        : null;

      return {
        therapist: th,
        shiftTime,
      };
    })
    .filter((item) => item.shiftTime !== null);

  return (
    <div className="space-y-6">
      {/* 日付切り替えタブバー (横スクロール対応) */}
      <div className="overflow-x-auto pb-2 scrollbar-none">
        <div className="flex gap-2 min-w-max px-1">
          {days.map((day) => {
            const isSelected = selectedDate === day.fullDate;
            return (
              <button
                key={day.fullDate}
                onClick={() => setSelectedDate(day.fullDate)}
                className={`flex flex-col items-center justify-center px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                  isSelected
                    ? isCyber
                      ? 'bg-[#ff8fc9] text-white border-[#ff8fc9] shadow-[0_0_18px_rgba(255,143,201,0.7)] scale-105'
                      : 'bg-[#a39573] text-white border-[#a39573] shadow-md scale-105'
                    : isCyber
                    ? 'bg-[#050014]/90 text-pink-200 border-[#ff8fc9]/30 hover:border-[#ff8fc9]/70 hover:bg-[#1a0933]'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                }`}
              >
                <span className="text-[10px] opacity-80">
                  {day.isToday ? '★ 本日' : `${day.month}月`}
                </span>
                <span className="text-sm font-extrabold tracking-wider">
                  {day.dateNum}日({day.dayOfWeek})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 選択日付タイトル */}
      <div className="flex items-center justify-between border-b pb-3 border-[#ff8fc9]/30 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#ff8fc9] animate-ping" />
          <h3 className={`text-base sm:text-lg font-bold tracking-wider ${isCyber ? 'neon-text-pink' : 'text-stone-800'}`}>
            {selectedDayObj.label} の出勤セラピスト
          </h3>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
          isCyber ? 'bg-[#ff8fc9]/20 text-pink-200 border border-[#ff8fc9]/40' : 'bg-stone-100 text-stone-600'
        }`}>
          計 {workingTherapistsWithShift.length} 名出勤
        </span>
      </div>

      {/* 出勤セラピスト 2列グリッド表示 */}
      {workingTherapistsWithShift.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {workingTherapistsWithShift.map(({ therapist, shiftTime }) => (
            <TherapistCard
              key={therapist.id}
              therapist={therapist}
              storeSlug={storeSlug}
              confirmedShiftTime={shiftTime || undefined}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-[#050014]/60 rounded-2xl border border-[#ff8fc9]/20">
          <p className="text-sm text-pink-300 font-semibold">
            指定のお日付の出勤スケジュールは準備中です 🐾
          </p>
        </div>
      )}
    </div>
  );
};
