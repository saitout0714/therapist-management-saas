import React from 'react';
import { Therapist } from '../../types/store';
import Link from 'next/link';

interface WeeklyScheduleProps {
  therapists: Therapist[];
  storeSlug: string;
}

export const WeeklySchedule: React.FC<WeeklyScheduleProps> = ({ therapists, storeSlug }) => {
  // 本日から7日間の日付データを生成
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const month = d.getMonth() + 1;
    const date = d.getDate();
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    return {
      fullDate: d.toISOString().split('T')[0],
      label: `${month}/${date}(${dayOfWeek})`,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: i === 0,
    };
  });

  return (
    <div className="overflow-x-auto bg-slate-900/60 rounded-2xl border border-slate-800 p-4 shadow-xl">
      <table className="w-full text-left text-xs text-slate-300 min-w-[600px]">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="py-3 px-4 font-bold text-slate-400 w-44">セラピスト</th>
            {days.map((day) => (
              <th
                key={day.fullDate}
                className={`py-3 px-2 text-center font-bold ${
                  day.isToday
                    ? 'text-rose-400 font-extrabold bg-rose-950/30 rounded-t-lg'
                    : day.isWeekend
                    ? 'text-pink-400'
                    : 'text-slate-300'
                }`}
              >
                {day.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {therapists.map((th) => (
            <tr key={th.id} className="hover:bg-slate-800/40 transition-colors">
              <td className="py-3 px-4">
                <Link
                  href={`/${storeSlug}/therapists/${th.id}`}
                  className="flex items-center gap-3 group"
                >
                  <img
                    src={th.avatarUrl}
                    alt={th.name}
                    className="w-10 h-10 rounded-full object-cover border border-rose-500/30 group-hover:scale-105 transition-transform"
                  />
                  <div>
                    <div className="font-bold text-white group-hover:text-rose-300 transition-colors">
                      {th.name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      T{th.height} ({th.bustCup})
                    </div>
                  </div>
                </Link>
              </td>
              {days.map((day, idx) => {
                // ダミー出勤データ（偶数日や本日などは出勤中と仮定）
                const isWorking = (th.id.charCodeAt(0) + idx) % 2 === 0 || day.isToday;
                const timeSlot = isWorking ? '13:00~22:00' : '-';

                return (
                  <td
                    key={day.fullDate}
                    className={`py-3 px-2 text-center text-[11px] ${
                      day.isToday ? 'bg-rose-950/20' : ''
                    }`}
                  >
                    {isWorking ? (
                      <span className="inline-block px-2 py-1 bg-rose-900/40 text-rose-300 border border-rose-500/30 rounded font-medium">
                        {timeSlot}
                      </span>
                    ) : (
                      <span className="text-slate-600">お休み</span>
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
