'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Therapist } from '../../types/store';

interface TherapistCardProps {
  therapist: Therapist;
  storeSlug: string;
  /** 内部リンクの先頭パス。独自ドメインでは ''、SaaS本体では `/${storeSlug}` （lib/shopDomains.ts 参照） */
  basePath?: string;
  confirmedShiftTime?: string;
  showTodayBadge?: boolean;
  primaryColor?: string;
  index?: number;
}

export const TherapistCard: React.FC<TherapistCardProps> = ({
  therapist,
  storeSlug,
  basePath,
  confirmedShiftTime,
  showTodayBadge = false,
  primaryColor = '#d1b464',
  index = 0,
}) => {
  const detailUrl = `${basePath ?? `/${storeSlug}`}/therapists/${therapist.id}`;
  const reserveUrl = `/reserve/${storeSlug}?therapist_id=${therapist.id}`;
  const isCyber = storeSlug === 'onyankospa' || primaryColor === '#ff6fb5';

  return (
    <div
      style={{
        animationDelay: `${index * 120}ms`,
        borderColor: isCyber ? undefined : `${primaryColor}60`
      }}
      className={`group relative overflow-hidden flex flex-col rounded-2xl therapist-card-reveal therapist-card-hover ${
        isCyber
          ? 'cyber-card'
          : 'classic-card bg-white border font-serif shadow-md'
      }`}
    >
      <Link href={detailUrl} className="block group/photo">
        {/* 写真領域 (写真クリックで個人詳細ページへ移動) */}
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-stone-900">
          <Image
            src={therapist.avatarUrl}
            alt={therapist.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover group-hover/photo:scale-110 transition-transform duration-700 ease-out"
          />
          
          {/* ホバー時のShimmer光沢ビーム光彩エフェクト */}
          <div className="shimmer-light-beam" />

          {/* グラデーションシャドウ */}
          <div className={`absolute inset-0 ${isCyber ? 'bg-gradient-to-t from-[#190a20]/95 via-[#190a20]/25 to-transparent' : 'bg-gradient-to-t from-stone-950/95 via-stone-950/20 to-transparent'}`} />

          {/* 左上バッジ群（新人リボンとカスタムバッジは独立して両方表示できる） */}
          {(therapist.isRookie || therapist.badge) && (
            <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
              {therapist.isRookie && (
                <span className="text-white font-extrabold text-[11px] px-3 py-1 rounded-full shadow-lg tracking-widest badge-float bg-gradient-to-r from-pink-500 to-rose-500">
                  ♥ 新人
                </span>
              )}
              {therapist.badge && (
                <span
                  style={{ backgroundColor: isCyber ? undefined : primaryColor }}
                  className={`text-white font-extrabold text-[11px] px-3 py-1 rounded-full shadow-lg tracking-widest badge-float ${
                    isCyber ? 'neon-badge-pink' : ''
                  }`}
                >
                  {therapist.badge}
                </span>
              )}
            </div>
          )}

          {/* 右上ランク・グレード */}
          {(therapist.rankName || therapist.grade) && (
            <div
              style={{ color: isCyber ? '#ffa8d8' : primaryColor, borderColor: isCyber ? '#ff6fb5' : `${primaryColor}80` }}
              className="absolute top-3 right-3 bg-stone-950/80 backdrop-blur-md border font-bold text-[10px] px-2.5 py-1 rounded-full tracking-wider shadow-md"
            >
              {therapist.rankName || therapist.grade}
            </div>
          )}

          {/* 写真下部の情報レイヤー */}
          <div className="absolute bottom-3 left-3.5 right-3.5 text-stone-100 space-y-1 group-hover/photo:translate-y-[-2px] transition-transform duration-300">
            <div className="flex items-baseline gap-2">
              <h3 className={`text-xl font-bold tracking-wider drop-shadow-md transition-colors ${
                isCyber ? 'neon-text-white' : 'text-stone-100 group-hover/photo:text-white'
              }`}>
                {therapist.name}
              </h3>
              <span style={{ color: isCyber ? '#ffa8d8' : primaryColor }} className="text-xs font-semibold drop-shadow">({therapist.age}歳)</span>
            </div>

            <p className="text-xs text-stone-200 font-sans tracking-wide drop-shadow">
              T{therapist.height} ({therapist.bustCup}cup) {therapist.threeSize ? `• ${therapist.threeSize}` : (therapist.bust && `• B${therapist.bust} W${therapist.waist || ''} H${therapist.hip || ''}`)}
            </p>

            {/* 確定出勤シフト時間帯バッジ */}
            {confirmedShiftTime && (
              <div className="pt-1 flex items-center gap-1.5">
                {showTodayBadge && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-white font-bold text-[10px] rounded-md shadow-sm ${
                    isCyber ? 'bg-[#ff6fb5] neon-on-pink' : 'bg-emerald-500/90'
                  }`}>
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse-dot shadow-[0_0_8px_#fff]" />
                    本日出勤
                  </span>
                )}
                <span style={{ color: isCyber ? '#ffa8d8' : primaryColor }} className="text-xs font-mono font-bold drop-shadow">
                  ⏰ {confirmedShiftTime}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* カードボディ */}
        <div className={`p-4 flex-1 flex flex-col justify-between space-y-3 ${
          isCyber
            ? 'bg-gradient-to-b from-white/12 to-[#150e20]/60 text-[#f4eefa]'
            : 'bg-gradient-to-b from-[#faf9f5] to-[#f4f2e9]'
        }`}>
          {/* 特徴タグバッジ */}
          <div className="flex flex-wrap gap-1">
            {therapist.tags.map((tag) => (
              <span
                key={tag}
                style={{ color: isCyber ? '#ffa8d8' : primaryColor, borderColor: isCyber ? 'rgba(255,111,181,0.35)' : `${primaryColor}40` }}
                className={`text-[10px] font-bold px-2 py-0.5 border rounded-md shadow-2xs transition-all duration-300 hover:scale-105 ${
                  isCyber ? 'bg-white/12 hover:bg-white/20' : 'bg-white hover:bg-stone-50'
                }`}
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* PRコメント */}
          {therapist.comment && (
            <p className={`text-xs line-clamp-2 italic tracking-wide leading-relaxed transition-opacity duration-300 ${
              isCyber ? 'text-[#ded1ee]' : 'text-stone-700'
            }`}>
              "{therapist.comment}"
            </p>
          )}
        </div>
      </Link>

      {/* ボタンアクション */}
      <div className={`p-4 pt-0 ${
        isCyber
          ? 'bg-[#150e20]/70'
          : 'bg-gradient-to-b from-[#faf9f5] to-[#f4f2e9]'
      }`}>
        <div className="pt-2">
          <Link
            href={reserveUrl}
            style={{ backgroundColor: isCyber ? undefined : primaryColor }}
            className={`block w-full py-2.5 sm:py-3 text-center text-xs sm:text-sm font-extrabold text-white tracking-widest active:scale-95 transition-all duration-300 ${
              isCyber
                ? 'rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8] hover:shadow-[0_0_20px_rgba(255,111,181,0.8)]'
                : 'rounded-xl shadow-md hover:shadow-lg hover:brightness-110'
            }`}
          >
            指名WEB予約 🐾
          </Link>
        </div>
      </div>

    </div>
  );
};
