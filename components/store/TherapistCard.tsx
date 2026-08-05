'use client';

import React from 'react';
import Link from 'next/link';
import { Therapist } from '../../types/store';

interface TherapistCardProps {
  therapist: Therapist;
  storeSlug: string;
  confirmedShiftTime?: string;
  primaryColor?: string;
}

export const TherapistCard: React.FC<TherapistCardProps> = ({
  therapist,
  storeSlug,
  confirmedShiftTime,
  primaryColor = '#d1b464',
}) => {
  const detailUrl = `/${storeSlug}/therapists/${therapist.id}`;
  const reserveUrl = `/${storeSlug}/reserve?therapistId=${therapist.id}`;
  const isCyber = storeSlug === 'onyankospa' || primaryColor === '#ff007f';

  return (
    <div
      style={{ borderColor: isCyber ? undefined : `${primaryColor}60` }}
      className={`group relative overflow-hidden flex flex-col transition-all duration-500 rounded-2xl shadow-md ${
        isCyber
          ? 'cyber-card font-sans border-[#ff007f]/40 hover:border-[#ff007f]'
          : 'bg-white border font-serif hover:shadow-2xl transform hover:-translate-y-1.5'
      }`}
    >
      
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
        <div className={`absolute inset-0 ${isCyber ? 'bg-gradient-to-t from-[#050014]/95 via-[#050014]/30 to-transparent' : 'bg-gradient-to-t from-stone-950/90 via-stone-950/20 to-transparent'}`} />

        {/* 左上バッジ (isRookie / NEW / 新人 / 看板猫) */}
        {(therapist.isRookie || therapist.badge) && (
          <div
            style={{ backgroundColor: isCyber ? undefined : primaryColor }}
            className={`absolute top-3 left-3 text-white font-extrabold text-[11px] px-3 py-1 rounded-full shadow-lg tracking-widest ${
              isCyber ? 'neon-badge-pink' : ''
            }`}
          >
            {therapist.isRookie ? '新人' : therapist.badge}
          </div>
        )}

        {/* 右上ランク・グレード */}
        {(therapist.rankName || therapist.grade) && (
          <div
            style={{ color: isCyber ? '#ff2a8d' : primaryColor, borderColor: isCyber ? '#ff007f' : `${primaryColor}80` }}
            className="absolute top-3 right-3 bg-stone-950/80 backdrop-blur-md border font-bold text-[10px] px-2.5 py-1 rounded-full tracking-wider shadow-md"
          >
            {therapist.rankName || therapist.grade}
          </div>
        )}

        {/* 写真下部の情報レイヤー */}
        <div className="absolute bottom-3 left-3.5 right-3.5 text-stone-100 space-y-1">
          <div className="flex items-baseline gap-2">
            <h3 className={`text-xl font-bold tracking-wider drop-shadow-md transition-colors ${
              isCyber ? 'neon-text-pink group-hover:text-white' : 'text-stone-100 group-hover:text-white'
            }`}>
              {therapist.name}
            </h3>
            <span style={{ color: isCyber ? '#ff2a8d' : primaryColor }} className="text-xs font-semibold drop-shadow">({therapist.age}歳)</span>
          </div>

          <p className="text-xs text-stone-200 font-sans tracking-wide drop-shadow">
            T{therapist.height} ({therapist.bustCup}cup) {therapist.threeSize ? `• ${therapist.threeSize}` : (therapist.bust && `• B${therapist.bust} W${therapist.waist || ''} H${therapist.hip || ''}`)}
          </p>

          {/* 確定出勤シフト時間帯バッジ */}
          {confirmedShiftTime && (
            <div className="pt-1 flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-white font-bold text-[10px] rounded-md shadow-sm ${
                isCyber ? 'bg-[#ff007f]' : 'bg-emerald-500/90'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                本日出勤
              </span>
              <span style={{ color: isCyber ? '#ff2a8d' : primaryColor }} className="text-xs font-mono font-bold drop-shadow">
                ⏰ {confirmedShiftTime}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* カードボディ */}
      <div className={`p-4 flex-1 flex flex-col justify-between space-y-3 ${
        isCyber
          ? 'bg-[#1a0933]/90 text-pink-50 font-sans'
          : 'bg-gradient-to-b from-[#faf9f5] to-[#f4f2e9]'
      }`}>
        {/* 特徴タグバッジ */}
        <div className="flex flex-wrap gap-1">
          {therapist.tags.map((tag) => (
            <span
              key={tag}
              style={{ color: isCyber ? '#ff2a8d' : primaryColor, borderColor: isCyber ? 'rgba(255,0,127,0.4)' : `${primaryColor}40` }}
              className={`text-[10px] font-bold px-2 py-0.5 border rounded-md shadow-2xs ${
                isCyber ? 'bg-[#050014]/80' : 'bg-white'
              }`}
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* PRコメント */}
        {therapist.comment && (
          <p className={`text-xs line-clamp-2 italic tracking-wide leading-relaxed ${
            isCyber ? 'text-pink-100' : 'text-stone-700'
          }`}>
            "{therapist.comment}"
          </p>
        )}

        {/* ボタンアクション */}
        <div className="pt-2 grid grid-cols-2 gap-2">
          <Link
            href={detailUrl}
            className={`py-2.5 text-center text-xs font-bold transition-all shadow-xs ${
              isCyber
                ? 'text-pink-100 bg-[#050014] hover:bg-[#1a0933] border border-[#ff007f]/40 rounded-full'
                : 'text-stone-800 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl'
            }`}
          >
            詳細
          </Link>
          <Link
            href={reserveUrl}
            style={{ backgroundColor: isCyber ? '#ff007f' : primaryColor }}
            className={`py-2.5 text-center text-xs font-bold text-white transition-all shadow-md tracking-wider hover:brightness-110 active:scale-95 ${
              isCyber ? 'rounded-full shadow-[0_0_12px_rgba(255,0,127,0.5)]' : 'rounded-xl'
            }`}
          >
            指名WEB予約
          </Link>
        </div>
      </div>

    </div>
  );
};
