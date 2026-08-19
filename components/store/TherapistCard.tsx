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
  const isLuxury = storeSlug === 'specialgrade';
  const hasRankBadge = Boolean(therapist.rankName || therapist.grade);

  return (
    <div
      style={{
        animationDelay: `${index * 120}ms`,
        borderColor: isCyber || isLuxury ? undefined : `${primaryColor}60`
      }}
      className={`group relative overflow-hidden flex flex-col rounded-2xl sm:rounded-3xl therapist-card-reveal ${
        isCyber
          ? 'cyber-card therapist-card-hover'
          : isLuxury
          ? 'luxury-photo-card !rounded-2xl sm:!rounded-3xl luxury-body'
          : 'classic-card bg-white border font-serif shadow-md therapist-card-hover'
      }`}
    >
      <div className="relative">
      <Link href={detailUrl} className="block group/photo">
        {/* 写真領域 (写真クリックで個人詳細ページへ移動) */}
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-stone-900">
          <Image
            src={therapist.avatarUrl}
            alt={therapist.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className={`object-cover transition-transform duration-700 ease-out ${isLuxury ? 'group-hover/photo:scale-105' : 'group-hover/photo:scale-110'}`}
          />

          {/* ホバー時のShimmer光沢ビーム光彩エフェクト */}
          <div className="shimmer-light-beam" />

          {/* グラデーションシャドウ */}
          <div className={`absolute inset-0 ${
            isCyber
              ? 'bg-gradient-to-t from-[#190a20]/95 via-[#190a20]/25 to-transparent'
              : isLuxury
              ? 'bg-gradient-to-t from-stone-950/80 via-stone-950/15 to-transparent'
              : 'bg-gradient-to-t from-stone-950/95 via-stone-950/20 to-transparent'
          }`} />

          {/* 左上バッジ群（新人リボンとカスタムバッジは独立して両方表示できる） */}
          {(therapist.isRookie || therapist.badge) && (
            <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
              {therapist.isRookie && (
                <span className={`text-[11px] px-3 py-0.5 rounded-full tracking-widest ${
                  isLuxury
                    ? 'text-[#c5a059] bg-[#fdf8f5] border border-[#e2b3b1]/50 font-medium font-luxury-display shadow-xs'
                    : 'text-white font-extrabold shadow-lg badge-float bg-gradient-to-r from-pink-500 to-rose-500'
                }`}>
                  {isLuxury ? '新人' : '♥ 新人'}
                </span>
              )}
              {therapist.badge && (
                <span
                  style={{ backgroundColor: isCyber || isLuxury ? undefined : primaryColor }}
                  className={`text-[11px] px-3 py-0.5 rounded-full tracking-widest ${
                    isCyber
                      ? 'text-white font-extrabold shadow-lg badge-float neon-badge-pink'
                      : isLuxury
                      ? 'text-[#c5a059] font-medium font-luxury-display bg-[#fdf8f5] border border-[#e2b3b1]/50 shadow-xs'
                      : 'text-white font-extrabold shadow-lg badge-float'
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
              style={{ color: isCyber ? '#ffa8d8' : isLuxury ? '#c5a059' : primaryColor, borderColor: isCyber ? '#ff6fb5' : isLuxury ? 'rgba(226,179,177,0.5)' : `${primaryColor}80` }}
              className={`absolute top-3 right-3 backdrop-blur-md border text-[10px] px-2.5 py-0.5 rounded-full tracking-wider ${
                isLuxury ? 'bg-[#fdf8f5]/95 font-medium shadow-xs' : 'bg-stone-950/80 font-bold shadow-md'
              }`}
            >
              {therapist.rankName || therapist.grade}
            </div>
          )}

          {/* 写真下部の情報レイヤー */}
          <div className={`absolute bottom-3 left-3.5 right-3.5 text-stone-100 space-y-1 transition-transform duration-300 ${isLuxury ? '' : 'group-hover/photo:translate-y-[-2px]'}`}>
            <div className="flex items-baseline gap-2">
              <h3 className={`tracking-wider drop-shadow-md transition-colors ${
                isCyber
                  ? 'text-xl font-bold neon-text-white'
                  : isLuxury
                  ? 'text-lg font-luxury-display font-medium text-white'
                  : 'text-xl font-bold text-stone-100 group-hover/photo:text-white'
              }`}>
                {therapist.name}
              </h3>
              <span style={{ color: isCyber ? '#ffa8d8' : isLuxury ? '#e5c989' : primaryColor }} className="text-xs font-medium drop-shadow">({therapist.age}歳)</span>
            </div>

            <p className={`text-stone-200 font-sans drop-shadow ${isLuxury ? 'text-[11px] tracking-wider' : 'text-xs tracking-wide'}`}>
              T{therapist.height} ({therapist.bustCup}cup) {therapist.threeSize ? `• ${therapist.threeSize}` : (therapist.bust && `• B${therapist.bust} W${therapist.waist || ''} H${therapist.hip || ''}`)}
            </p>

            {/* 確定出勤シフト時間帯バッジ */}
            {confirmedShiftTime && (
              <div className="pt-1 flex items-center gap-1.5">
                {showTodayBadge && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-white text-[10px] rounded-md shadow-sm ${
                    isCyber ? 'font-bold bg-[#ff6fb5] neon-on-pink' : isLuxury ? 'font-medium bg-[#c5a059]' : 'font-bold bg-emerald-500/90'
                  }`}>
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse-dot shadow-[0_0_8px_#fff]" />
                    本日出勤
                  </span>
                )}
                <span style={{ color: isCyber ? '#ffa8d8' : isLuxury ? '#e5c989' : primaryColor }} className={`text-xs font-mono drop-shadow ${isLuxury ? 'font-medium' : 'font-bold'}`}>
                  ⏰ {confirmedShiftTime}
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* 公式Xリンク（写真右上にオーバーレイ表示。ランク/グレードバッジがある場合はその下に。
          Linkと入れ子にできないので兄弟要素にする） */}
      {therapist.twitterUrl && (
        <a
          href={therapist.twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${therapist.name}さんの公式X`}
          onClick={(e) => e.stopPropagation()}
          className={`absolute right-3 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-stone-950/80 backdrop-blur-md border border-white/25 text-white shadow-md transition-all hover:scale-110 hover:bg-black ${
            hasRankBadge ? 'top-12' : 'top-3'
          }`}
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
      )}
      </div>

      <Link href={detailUrl} className="block">
        {/* カードボディ */}
        <div className={`p-4 flex-1 flex flex-col justify-between space-y-3 ${
          isCyber
            ? 'bg-gradient-to-b from-white/12 to-[#150e20]/60 text-[#f4eefa]'
            : isLuxury
            ? 'bg-white'
            : 'bg-gradient-to-b from-[#faf9f5] to-[#f4f2e9]'
        }`}>
          {/* 特徴タグバッジ */}
          <div className="flex flex-wrap gap-1">
            {therapist.tags.map((tag) => (
              <span
                key={tag}
                style={{ color: isCyber ? '#ffa8d8' : isLuxury ? '#c5a059' : primaryColor, borderColor: isCyber ? 'rgba(255,111,181,0.35)' : isLuxury ? 'rgba(226,179,177,0.45)' : `${primaryColor}40` }}
                className={`text-[10px] px-2.5 py-0.5 border rounded-full shadow-2xs transition-all duration-300 hover:scale-105 ${
                  isCyber ? 'font-bold bg-white/12 hover:bg-white/20' : isLuxury ? 'font-medium bg-[#fdf8f5] hover:bg-white' : 'font-bold bg-white hover:bg-stone-50'
                }`}
              >
                #{tag}
              </span>
            ))}
          </div>

          {/* PRコメント */}
          {therapist.comment && (
            <p className={`text-xs line-clamp-2 italic tracking-wide leading-relaxed transition-opacity duration-300 ${
              isCyber ? 'text-[#ded1ee]' : isLuxury ? 'text-[#5c5250]' : 'text-stone-700'
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
          : isLuxury
          ? 'bg-white'
          : 'bg-gradient-to-b from-[#faf9f5] to-[#f4f2e9]'
      }`}>
        <div className="pt-2">
          <Link
            href={reserveUrl}
            style={{ backgroundColor: isCyber || isLuxury ? undefined : primaryColor }}
            className={`block w-full py-2.5 sm:py-3 text-center text-xs sm:text-sm tracking-widest active:scale-95 transition-all duration-300 ${
              isLuxury ? 'font-medium' : 'font-extrabold'
            } text-white ${
              isCyber
                ? 'rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8] hover:shadow-[0_0_20px_rgba(255,111,181,0.8)]'
                : isLuxury
                ? 'rounded-full luxury-gold-btn shadow-md'
                : 'rounded-xl shadow-md hover:shadow-lg hover:brightness-110'
            }`}
          >
            {isLuxury ? 'RESERVE' : '指名WEB予約 🐾'}
          </Link>
        </div>
      </div>

    </div>
  );
};
