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
    <div className="group relative bg-white rounded-sm border border-[#d1b464]/30 overflow-hidden shadow-sm hover:shadow-md hover:border-[#d1b464] transition-all duration-300 flex flex-col font-serif">
      {/* メイン写真 */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-stone-100">
        <img
          src={therapist.avatarUrl}
          alt={therapist.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900/70 via-transparent to-transparent" />

        {/* バッジ (NEW / 新人 / PICKUP) */}
        {therapist.badge && (
          <div className="absolute top-2 left-2 bg-gradient-to-r from-[#d1b464] to-[#a39573] text-white font-bold text-[10px] px-2.5 py-0.5 rounded-sm shadow-sm tracking-wider">
            {therapist.badge}
          </div>
        )}

        {/* グレード (例: トップセラピスト) */}
        {therapist.grade && (
          <div className="absolute top-2 right-2 bg-stone-900/80 text-[#d1b464] border border-[#d1b464]/40 font-medium text-[9px] px-2 py-0.5 rounded-sm tracking-wider">
            {therapist.grade}
          </div>
        )}

        {/* 下部オーバーレイ情報 */}
        <div className="absolute bottom-2.5 left-3 right-3 text-white">
          <div className="flex items-baseline gap-2 mb-0.5">
            <h3 className="text-lg font-bold tracking-wider">{therapist.name}</h3>
            <span className="text-xs text-[#d1b464] font-semibold">({therapist.age}歳)</span>
          </div>
          <p className="text-[11px] text-stone-200 tracking-wide">
            T{therapist.height} ({therapist.bustCup}cup) {therapist.threeSize && `• ${therapist.threeSize}`}
          </p>
        </div>
      </div>

      {/* コンテンツエリア */}
      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3 bg-[#faf9f5]">
        {/* 特徴タグバッジ */}
        <div className="flex flex-wrap gap-1">
          {therapist.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-medium bg-white text-[#a39573] px-2 py-0.5 border border-[#d1b464]/30 rounded-sm"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* 一言コメント */}
        {therapist.comment && (
          <p className="text-xs text-stone-600 line-clamp-2 italic tracking-wide">
            "{therapist.comment}"
          </p>
        )}

        {/* アクションボタン */}
        <div className="pt-2 grid grid-cols-2 gap-2">
          <Link
            href={detailUrl}
            className="py-2 text-center text-xs font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 transition-colors"
          >
            詳細を見る
          </Link>
          <Link
            href={reserveUrl}
            className="py-2 text-center text-xs font-bold text-white bg-[#a39573] hover:bg-[#8f8263] border border-[#a39573] transition-colors tracking-wider"
          >
            指名予約
          </Link>
        </div>
      </div>
    </div>
  );
};
