import React from 'react';
import Link from 'next/link';
import { Therapist } from '../../types/store';

interface TherapistCardProps {
  therapist: Therapist;
  storeSlug: string;
}

export const TherapistCard: React.FC<TherapistCardProps> = ({ therapist, storeSlug }) => {
  const detailUrl = `/${storeSlug}/therapists/${therapist.id}`;
  const reserveUrl = `/${storeSlug}/reserve?therapistId=${therapist.id}`;

  return (
    <div className="group relative bg-slate-900/80 rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl hover:border-rose-500/50 hover:shadow-2xl hover:shadow-rose-950/30 transition-all duration-300 flex flex-col">
      {/* メイン写真 */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-950">
        <img
          src={therapist.avatarUrl}
          alt={therapist.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />

        {/* バッジ (NEW / 新人 / PICKUP) */}
        {therapist.badge && (
          <div className="absolute top-3 left-3 bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 text-white font-extrabold text-[11px] px-3 py-1 rounded-full shadow-lg shadow-rose-900/50 tracking-wider animate-pulse">
            {therapist.badge}
          </div>
        )}

        {/* グレード (例: トップセラピスト) */}
        {therapist.grade && (
          <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md border border-amber-500/40 text-amber-300 font-semibold text-[10px] px-2.5 py-0.5 rounded-full">
            {therapist.grade}
          </div>
        )}

        {/* 下部オーバーレイ情報 */}
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-baseline gap-2 mb-1">
            <h3 className="text-xl font-bold text-white group-hover:text-rose-300 transition-colors">
              {therapist.name}
            </h3>
            <span className="text-sm font-semibold text-rose-300">({therapist.age}歳)</span>
          </div>
          <p className="text-xs font-medium text-slate-300 tracking-wide">
            T{therapist.height}cm ({therapist.bustCup}cup) {therapist.threeSize && `• ${therapist.threeSize}`}
          </p>
        </div>
      </div>

      {/* コンテンツエリア */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        {/* 特徴タグバッジ */}
        <div className="flex flex-wrap gap-1.5">
          {therapist.tags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] font-medium bg-slate-800/90 text-rose-300 px-2.5 py-0.5 rounded-md border border-rose-500/20"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* 一言コメント */}
        {therapist.comment && (
          <p className="text-xs text-slate-400 line-clamp-2 italic">
            "{therapist.comment}"
          </p>
        )}

        {/* アクションボタン */}
        <div className="pt-2 grid grid-cols-2 gap-2">
          <Link
            href={detailUrl}
            className="py-2 text-center text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            プロフィール
          </Link>
          <Link
            href={reserveUrl}
            className="py-2 text-center text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 rounded-xl shadow-md shadow-rose-600/30 transition-all"
          >
            指名予約
          </Link>
        </div>
      </div>
    </div>
  );
};
