'use client';

import React, { useState, useEffect } from 'react';
import { Campaign } from '../../types/store';

interface HeroBannerSliderProps {
  campaigns: Campaign[];
  isCyber?: boolean;
}

export const HeroBannerSlider: React.FC<HeroBannerSliderProps> = ({ campaigns, isCyber = false }) => {
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
    <div className={`relative w-full overflow-hidden rounded-2xl border shadow-2xl group bg-stone-900 ${
      isCyber ? 'border-[#ff8fc9]/40 font-sans shadow-[0_0_20px_rgba(255,143,201,0.3)]' : 'border-[#d1b464]/30 font-serif'
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
            <img
              src={camp.imageUrl}
              alt={camp.title}
              className="w-full h-full object-cover transform scale-105 group-hover:scale-100 transition-transform duration-700"
            />
            {/* ダークグラデーションオーバーレイ */}
            <div className={`absolute inset-0 ${isCyber ? 'bg-gradient-to-t from-[#050014]/95 via-[#050014]/30 to-transparent' : 'bg-gradient-to-t from-stone-950/80 via-stone-950/20 to-transparent'}`} />

            {/* バナーキャプション */}
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-stone-100 space-y-1 sm:space-y-2">
              {camp.badgeText && (
                <span className={`inline-block px-3 py-1 font-bold text-[10px] sm:text-xs rounded-full shadow-md ${
                  isCyber ? 'neon-badge-pink' : 'bg-[#d1b464] text-stone-950'
                }`}>
                  {camp.badgeText}
                </span>
              )}
              <h3 className={`text-base sm:text-2xl font-bold tracking-wider drop-shadow-md ${
                isCyber ? 'neon-text-pink' : 'text-stone-100'
              }`}>
                {camp.title}
              </h3>
              {camp.description && (
                <p className={`text-xs sm:text-sm line-clamp-1 sm:line-clamp-2 drop-shadow ${
                  isCyber ? 'text-pink-100' : 'text-stone-300'
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
        <div className={`absolute bottom-3 right-4 z-20 flex items-center gap-1.5 backdrop-blur-sm px-3 py-1.5 rounded-full border ${
          isCyber ? 'bg-[#050014]/80 border-[#ff8fc9]/40' : 'bg-stone-950/60 border-white/10'
        }`}>
          {campaigns.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === currentIndex
                  ? isCyber ? 'w-6 bg-[#ff8fc9] shadow-[0_0_8px_#ff8fc9]' : 'w-6 bg-[#d1b464]'
                  : 'w-2 bg-stone-500 hover:bg-stone-300'
              }`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* 左右切替ボタン */}
      {campaigns.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIndex((prev) => (prev === 0 ? campaigns.length - 1 : prev - 1))}
            className={`absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm ${
              isCyber ? 'bg-[#050014]/80 hover:bg-[#ff8fc9] hover:text-white border border-[#ff8fc9]/40' : 'bg-stone-950/60 hover:bg-[#d1b464] hover:text-stone-950'
            }`}
          >
            ❮
          </button>
          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % campaigns.length)}
            className={`absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm ${
              isCyber ? 'bg-[#050014]/80 hover:bg-[#ff8fc9] hover:text-white border border-[#ff8fc9]/40' : 'bg-stone-950/60 hover:bg-[#d1b464] hover:text-stone-950'
            }`}
          >
            ❯
          </button>
        </>
      )}
    </div>
  );
};
