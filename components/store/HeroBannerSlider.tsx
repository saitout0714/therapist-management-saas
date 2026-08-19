'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Campaign } from '../../types/store';

interface HeroBannerSliderProps {
  campaigns: Campaign[];
  isCyber?: boolean;
  isLuxury?: boolean;
}

export const HeroBannerSlider: React.FC<HeroBannerSliderProps> = ({ campaigns, isCyber = false, isLuxury = false }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (campaigns.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % campaigns.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [campaigns.length]);

  if (!campaigns || campaigns.length === 0) return null;

  return (
    <div className={`relative w-full overflow-hidden group bg-stone-900 ${
      isCyber
        ? 'rounded-2xl border shadow-2xl border-[#ff6fb5]/40 font-sans shadow-[0_0_20px_rgba(255,111,181,0.3)]'
        : isLuxury
        ? 'rounded-2xl sm:rounded-3xl border border-[#e2b3b1]/35 shadow-[0_10px_30px_rgba(226,179,177,0.14)] luxury-body'
        : 'rounded-2xl border shadow-2xl border-[#d1b464]/30 font-serif'
    }`}>
      {/* メインアスペクト比 16:9 領域 */}
      <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] overflow-hidden">
        {campaigns.map((camp, idx) => (
          <div
            key={camp.id}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              idx === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            <Image
              src={camp.imageUrl}
              alt={camp.title}
              fill
              sizes="(min-width: 640px) 90vw, 100vw"
              className="object-cover transform scale-105 group-hover:scale-100 transition-transform duration-700"
            />
            {/* ダークグラデーションオーバーレイ */}
            <div className={`absolute inset-0 ${
              isCyber
                ? 'bg-gradient-to-t from-[#190a20]/90 via-[#190a20]/25 to-transparent'
                : isLuxury
                ? 'bg-gradient-to-t from-stone-950/75 via-stone-950/15 to-transparent'
                : 'bg-gradient-to-t from-stone-950/80 via-stone-950/20 to-transparent'
            }`} />

            {/* バナーキャプション */}
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-stone-100 space-y-1 sm:space-y-2">
              {camp.badgeText && (
                <span className={`inline-block px-3 py-1 text-[10px] sm:text-xs rounded-full shadow-md ${
                  isCyber ? 'font-bold neon-badge-pink' : isLuxury ? 'font-medium tracking-wider bg-white/95 text-[#c5a059] border border-[#e2b3b1]/50 shadow-sm' : 'font-bold bg-[#d1b464] text-stone-950'
                }`}>
                  {camp.badgeText}
                </span>
              )}
              <h3 className={`drop-shadow-md ${
                isCyber
                  ? 'tracking-wider text-base sm:text-2xl font-bold neon-text-white'
                  : isLuxury
                  ? 'tracking-[0.12em] text-base sm:text-xl font-luxury-display font-medium text-white'
                  : 'tracking-wider text-base sm:text-2xl font-bold text-stone-100'
              }`}>
                {camp.title}
              </h3>
              {camp.description && (
                <p className={`text-xs sm:text-sm line-clamp-1 sm:line-clamp-2 drop-shadow ${
                  isCyber ? 'text-pink-50' : isLuxury ? 'text-white/90 font-light' : 'text-stone-300'
                }`}>
                  {camp.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* インジケータードット */}
      {campaigns.length > 1 && (
        <div className={`absolute bottom-3 right-4 z-20 flex items-center gap-0.5 backdrop-blur-sm px-1.5 py-0.5 rounded-full border ${
          isCyber ? 'bg-white/10 border-[#ff6fb5]/40' : isLuxury ? 'bg-black/25 border-white/20' : 'bg-stone-950/60 border-white/10'
        }`}>
          {campaigns.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className="flex h-6 w-6 items-center justify-center"
              aria-label={`スライド ${idx + 1} を表示`}
              aria-current={idx === currentIndex ? 'true' : undefined}
            >
              <span
                className={`h-2 rounded-full transition-all ${
                  idx === currentIndex
                    ? isCyber ? 'w-6 bg-[#ff6fb5] shadow-[0_0_8px_#ff6fb5]' : isLuxury ? 'w-6 bg-gradient-to-r from-[#d4af37] to-[#e2b3b1]' : 'w-6 bg-[#d1b464]'
                    : 'w-2 bg-stone-500 hover:bg-stone-300'
                }`}
              />
            </button>
          ))}
        </div>
      )}

      {/* 左右切替ボタン */}
      {campaigns.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIndex((prev) => (prev === 0 ? campaigns.length - 1 : prev - 1))}
            className={`absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm ${
              isCyber
                ? 'bg-white/10 text-[#ffa8d8] hover:bg-[#ff6fb5] hover:text-white border border-[#ff6fb5]/40'
                : isLuxury
                ? 'bg-black/30 hover:bg-[#c5a059] border border-white/20'
                : 'bg-stone-950/60 hover:bg-[#d1b464] hover:text-stone-950'
            }`}
          >
            ❮
          </button>
          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % campaigns.length)}
            className={`absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm ${
              isCyber
                ? 'bg-white/10 text-[#ffa8d8] hover:bg-[#ff6fb5] hover:text-white border border-[#ff6fb5]/40'
                : isLuxury
                ? 'bg-black/30 hover:bg-[#c5a059] border border-white/20'
                : 'bg-stone-950/60 hover:bg-[#d1b464] hover:text-stone-950'
            }`}
          >
            ❯
          </button>
        </>
      )}
    </div>
  );
};
