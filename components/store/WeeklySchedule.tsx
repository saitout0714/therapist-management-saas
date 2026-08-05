import React from 'react';
import { Therapist, ConfirmedShift } from '../../types/store';
import Link from 'next/link';

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
      label: `${d.getMonth() + 1}/${d.getDate()}(${dayOfWeek})`,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: i === 0,
    };
  });

  // (therapistId, fullDate) => ConfirmedShift Map を作成
  const shiftMap = new Map<string, ConfirmedShift>();
  confirmedShifts.forEach((s) => {
    shiftMap.set(`${s.therapistId}_${s.date}`, s);
  });

  const hasRealShifts = confirmedShifts.length > 0;

  return (
    <div className={`overflow-x-auto p-4 ${
      isCyber
        ? 'cyber-card rounded-xl border-[#ff007f]/40 font-sans'
        : 'bg-white rounded-sm border border-[#d1b464]/30 shadow-sm font-serif'
    }`}>
      <table className="w-full text-left text-xs min-w-[600px]">
        <thead>
          <tr className={`border-b ${
            isCyber ? 'border-[#ff007f]/30 bg-[#050014]' : 'border-[#d1b464]/30 bg-[#faf7f0]'
          }`}>
            <th className={`py-3 px-4 font-bold w-44 ${isCyber ? 'text-pink-100' : 'text-stone-700'}`}>セラピスト</th>
            {days.map((day) => (
              <th
                key={day.fullDate}
                className={`py-3 px-2 text-center font-bold ${
                  day.isToday
                    ? isCyber ? 'neon-text-pink font-extrabold bg-[#ff007f]/20' : 'text-[#a39573] font-extrabold bg-[#f4eee0]'
                    : day.isWeekend
                    ? isCyber ? 'text-pink-300' : 'text-amber-700'
                    : isCyber ? 'text-stone-300' : 'text-stone-700'
                }`}
              >
                {day.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={`divide-y ${isCyber ? 'divide-[#ff007f]/20' : 'divide-stone-100'}`}>
          {therapists.map((th) => (
            <tr key={th.id} className={`transition-colors ${isCyber ? 'hover:bg-[#1a0933]/60' : 'hover:bg-[#faf9f5]'}`}>
              <td className="py-3 px-4">
                <Link
                  href={`/${storeSlug}/therapists/${th.id}`}
                  className="flex items-center gap-3 group"
                >
                  <img
                    src={th.avatarUrl}
                    alt={th.name}
                    className={`w-10 h-10 rounded-full object-cover border group-hover:scale-105 transition-transform ${
                      isCyber ? 'border-[#ff007f]/50 shadow-[0_0_8px_rgba(255,0,127,0.4)]' : 'border-[#d1b464]/40'
                    }`}
                  />
                  <div>
                    <div className={`font-bold transition-colors ${
                      isCyber ? 'neon-text-pink group-hover:text-white' : 'text-stone-800 group-hover:text-[#a39573]'
                    }`}>
                      {th.name}
                    </div>
                    <div className={`text-[10px] ${isCyber ? 'text-pink-300/80' : 'text-stone-400'}`}>
                      T{th.height} ({th.bustCup})
                    </div>
                  </div>
                </Link>
              </td>
              {days.map((day, idx) => {
                const shift = shiftMap.get(`${th.id}_${day.fullDate}`);
                const isWorkingFallback = !hasRealShifts && ((th.id.charCodeAt(0) + idx) % 2 === 0 || day.isToday);
                const displayTime = shift ? `${shift.startTime}~${shift.endTime}` : (isWorkingFallback ? '13:00~22:00' : null);

                return (
                  <td
                    key={day.fullDate}
                    className={`py-3 px-2 text-center text-[11px] ${
                      day.isToday ? (isCyber ? 'bg-[#ff007f]/10' : 'bg-[#faf7f0]/60') : ''
                    }`}
                  >
                    {displayTime ? (
                      <span className={`inline-block px-2 py-1 border rounded text-[10px] font-medium ${
                        isCyber
                          ? 'bg-[#ff007f]/20 text-pink-200 border-[#ff007f]/40 shadow-[0_0_6px_rgba(255,0,127,0.3)]'
                          : 'bg-[#f4eee0] text-[#7d7468] border-[#d1b464]/30'
                      }`}>
                        {displayTime}
                      </span>
                    ) : (
                      <span className={isCyber ? 'text-pink-300/40' : 'text-stone-400'}>お休み</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
