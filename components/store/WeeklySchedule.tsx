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
  /** 店舗の営業日切り替え時刻(JST)を考慮した「本日の営業日」文字列 (YYYY-MM-DD)。
   *  未指定の場合はブラウザのローカル日付にフォールバックする。 */
  businessTodayStr?: string;
}

export const WeeklySchedule: React.FC<WeeklyScheduleProps> = ({
  therapists,
  confirmedShifts = [],
  storeSlug,
  businessTodayStr,
}) => {
  const isCyber = storeSlug === 'onyankospa';

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

  // businessTodayStr は呼び出し元（サーバーコンポーネント）が初回描画時点で渡すため、
  // days[0].fullDate は既に正しい営業日になっている。
  // 以前は取得が非同期だったので effect で選択日を後から合わせ直していたが、その必要はなくなった。
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
    // 出勤時間順（早い時間から）に表示する
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
                className={`flex flex-col items-center justify-center py-2 px-0.5 sm:px-2 rounded-lg sm:rounded-xl text-center transition-all border w-full min-w-0 ${
                  isSelected
                    ? isCyber
                      ? 'bg-gradient-to-b from-[#ff6fb5] to-[#e04899] text-white border-[#ff6fb5] shadow-[0_0_14px_rgba(255,111,181,0.7)] scale-[1.02] z-10'
                      : 'bg-[#a39573] text-white border-[#a39573] shadow-md scale-[1.02] z-10'
                    : isCyber
                    ? 'bg-white/90 backdrop-blur-md text-slate-900 border-[#ff6fb5]/40 hover:border-[#ff6fb5] hover:bg-white shadow-sm'
                    : 'bg-white/90 backdrop-blur-md text-stone-800 border-stone-200 hover:bg-white'
                }`}
              >
                <span
                  className={`text-[9px] sm:text-[11px] font-extrabold leading-tight ${
                    isSelected
                      ? 'text-white'
                      : day.isToday
                      ? 'text-[#ff4fa3]'
                      : isSun
                      ? 'text-red-500'
                      : isSat
                      ? 'text-blue-500'
                      : 'text-slate-600'
                  }`}
                >
                  {day.isToday ? '本日' : `(${day.dayOfWeek})`}
                </span>
                <span
                  className={`text-xs sm:text-base font-extrabold tracking-tight leading-tight mt-0.5 whitespace-nowrap ${
                    isSelected ? 'text-white' : 'text-slate-900'
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
      <div className="flex items-center justify-between border-b pb-3 border-[#ff6fb5]/30 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#ff6fb5] animate-ping" />
          <h3 className={`text-base sm:text-lg font-bold tracking-wider ${isCyber ? 'neon-text-pink' : 'text-stone-800'}`}>
            {selectedDayObj.label} の出勤セラピスト
          </h3>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
          isCyber ? 'bg-[#ff6fb5]/20 text-[#c4b2dc] border border-[#ff6fb5]/40' : 'bg-stone-100 text-stone-600'
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
              confirmedShiftTime={shiftTime || undefined}
              index={idx}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white/8 rounded-2xl border border-[#ff6fb5]/20">
          <p className="text-sm text-[#ffa8d8] font-semibold">
            指定のお日付の出勤スケジュールは準備中です 🐾
          </p>
        </div>
      )}
    </div>
  );
};
