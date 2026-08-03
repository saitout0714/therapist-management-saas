'use client';

import React from 'react';
import Link from 'next/link';
import { Therapist } from '../../types/store';

interface TherapistCardProps {
  therapist: Therapist;
  storeSlug: string;
  confirmedShiftTime?: string; // 例: "12:00 ~ 21:00"
}

export const TherapistCard: React.FC<TherapistCardProps> = ({
  therapist,
  storeSlug,
  confirmedShiftTime,
}) => {
  const detailUrl = `/${storeSlug}/therapists/${therapist.id}`;
  const reserveUrl = `/${storeSlug}/reserve?therapistId=${therapist.id}`;

  return (
    <div className="group relative bg-white rounded-2xl border border-[#d1b464]/40 overflow-hidden shadow-md hover:shadow-2xl hover:border-[#d1b464] transform hover:-translate-y-1.5 transition-all duration-500 flex flex-col font-serif">
      
      {/* 写真領域 */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-stone-900">
        <img
          src={therapist.avatarUrl}
          alt={therapist.name}
          className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
        />
        
        {/* ホバー時のShimmer光沢エフェクト */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />

        {/* グラデーションシャドウ */}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/20 to-transparent" />

        {/* 左上バッジ (isRookie / NEW / 新人 / PICKUP) */}
        {(therapist.isRookie || therapist.badge) && (
          <div className="absolute top-3 left-3 bg-gradient-to-r from-[#f6d365] via-[#d1b464] to-[#b8860b] text-stone-950 font-extrabold text-[11px] px-3 py-1 rounded-full shadow-lg tracking-widest border border-yellow-200/50">
            {therapist.isRookie ? '新人' : therapist.badge}
          </div>
        )}

        {/* 右上ランク・グレード */}
        {(therapist.rankName || therapist.grade) && (
          <div className="absolute top-3 right-3 bg-stone-950/80 backdrop-blur-md text-[#d1b464] border border-[#d1b464]/60 font-bold text-[10px] px-2.5 py-1 rounded-full tracking-wider shadow-md">
            {therapist.rankName || therapist.grade}
          </div>
        )}

        {/* 写真下部の情報レイヤー */}
        <div className="absolute bottom-3 left-3.5 right-3.5 text-stone-100 space-y-1">
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-bold tracking-wider drop-shadow-md text-stone-100 group-hover:text-[#f6d365] transition-colors">
              {therapist.name}
            </h3>
            <span className="text-xs text-[#d1b464] font-semibold drop-shadow">({therapist.age}歳)</span>
          </div>

          <p className="text-xs text-stone-200 font-sans tracking-wide drop-shadow">
            T{therapist.height} ({therapist.bustCup}cup) {therapist.threeSize ? `• ${therapist.threeSize}` : (therapist.bust && `• B${therapist.bust} W${therapist.waist || ''} H${therapist.hip || ''}`)}
          </p>

          {/* 部屋割り確定出勤シフト時間帯バッジ */}
          {confirmedShiftTime && (
            <div className="pt-1 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/90 text-white font-bold text-[10px] rounded-md shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                本日出勤
              </span>
              <span className="text-xs font-mono font-bold text-[#f6d365] drop-shadow">
                ⏰ {confirmedShiftTime}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* カードボディ */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3 bg-gradient-to-b from-[#faf9f5] to-[#f4f2e9]">
        {/* 特徴タグバッジ */}
        <div className="flex flex-wrap gap-1">
          {therapist.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-bold bg-white text-[#8c7853] px-2 py-0.5 border border-[#d1b464]/30 rounded-md shadow-2xs"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* PRコメント */}
        {therapist.comment && (
          <p className="text-xs text-stone-700 line-clamp-2 italic tracking-wide leading-relaxed">
            "{therapist.comment}"
          </p>
        )}

        {/* ボタンアクション */}
        <div className="pt-2 grid grid-cols-2 gap-2">
          <Link
            href={detailUrl}
            className="py-2.5 text-center text-xs font-bold text-stone-800 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl transition-all shadow-xs"
          >
            プロフィール
          </Link>
          <Link
            href={reserveUrl}
            className="py-2.5 text-center text-xs font-bold text-stone-950 bg-gradient-to-r from-[#d1b464] to-[#a39573] hover:from-[#c2a353] hover:to-[#928462] border border-[#d1b464] rounded-xl transition-all shadow-md tracking-wider active:scale-95"
          >
            指名WEB予約
          </Link>
        </div>
      </div>

    </div>
  );
};
