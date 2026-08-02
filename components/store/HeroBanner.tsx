'use client';

import React, { useState, useEffect } from 'react';
import { Campaign, StoreConfig } from '../../types/store';

interface HeroBannerProps {
  campaigns: Campaign[];
  store: StoreConfig;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ campaigns, store }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const campaignList = campaigns && campaigns.length > 0 ? campaigns : [];

  // 自動フェード切替 (3.5秒ごと)
  useEffect(() => {
    if (campaignList.length <= 1 || isHovered) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % campaignList.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [campaignList.length, isHovered]);

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % campaignList.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + campaignList.length) % campaignList.length);
  };

  return (
    <div className="font-serif bg-[#faf9f5]">
      {/* 1. smart-info (電話ボタン・案内) */}
      <section className="bg-white/95 py-6 px-4 border-b border-[#d1b464]/30 text-center shadow-xs">
        <div className="max-w-2xl mx-auto space-y-2">
          <div className="text-xs sm:text-sm font-semibold text-stone-700 tracking-widest">
            赤羽・川口 メンズエステ<br />
            <span className="text-xl sm:text-2xl font-bold text-stone-900 tracking-widest leading-relaxed">
              {store.name}
            </span>
          </div>
          <div className="text-xs text-stone-600 tracking-widest">
            {store.accessInfo}
          </div>
          <div className="text-xs text-[#a39573] font-medium tracking-wider">
            {store.businessHours}
          </div>

          <div className="pt-2">
            <a
              href={`tel:${store.phoneNumber}`}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3 text-xs sm:text-sm font-bold text-stone-800 bg-gradient-to-r from-[#ffffd0] via-[#d1b464] to-[#ffffd0] border border-[#b89a4b] rounded-sm shadow-md hover:brightness-105 transition-all tracking-widest group"
            >
              <span className="text-base group-hover:scale-110 transition-transform">📞</span> お店に電話する ({store.phoneNumber})
            </a>
          </div>
        </div>
      </section>

      {/* 2. トップコンセプト */}
      <section className="bg-[#faf7f0] py-8 px-4 border-b border-[#d1b464]/20 text-center">
        <div className="max-w-3xl mx-auto space-y-2">
          <h2 className="text-lg sm:text-xl font-bold text-stone-800 tracking-widest">
            赤羽・川口のメンズエステ<br />
            <span className="block text-xs sm:text-sm font-normal text-[#a39573] mt-1 tracking-widest">
              Special Grade ～上質で優雅な至福の空間～
            </span>
          </h2>
          <p className="text-xs text-stone-600 leading-relaxed tracking-wider pt-2 max-w-2xl mx-auto">
            最高級をお求めのお客様のために「技術」「ルックス」「性格」の三点を厳選して日本人女性を採用。
            上質で優雅な至福の空間をどうぞご堪能ください。
          </p>
        </div>
      </section>

      {/* 3. 自動フェードイン・フェードアウト スライダー */}
      {campaignList.length > 0 && (
        <section className="bg-white py-8 border-b border-[#d1b464]/20 relative">
          <div className="max-w-4xl mx-auto px-4">
            {/* 特有のセクションタイトル (.top-title) */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-stone-800 tracking-widest">Information</h2>
              <span className="inline-block text-xs text-[#a39573] border-t border-stone-800 px-4 pt-1 mt-1 tracking-widest">
                インフォメーション
              </span>
            </div>

            {/* フェードスライダーコンテナ */}
            <div
              className="relative aspect-[16/9] sm:aspect-[21/9] w-full overflow-hidden rounded-sm border border-[#d1b464]/40 bg-stone-900 shadow-md group"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {/* 各バナー画像 (opacity 1s のクロスフェード切り替え) */}
              {campaignList.map((camp, idx) => {
                const isActive = currentIndex === idx;
                return (
                  <div
                    key={camp.id}
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                      isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                    }`}
                  >
                    <img
                      src={camp.imageUrl}
                      alt={camp.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                );
              })}

              {/* 左右ナビゲーションボタン */}
              {campaignList.length > 1 && (
                <>
                  <button
                    onClick={handlePrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-stone-900/60 text-white flex items-center justify-center hover:bg-[#d1b464] transition-colors border border-white/20 backdrop-blur-xs opacity-80 group-hover:opacity-100"
                    aria-label="前へ"
                  >
                    ‹
                  </button>
                  <button
                    onClick={handleNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-stone-900/60 text-white flex items-center justify-center hover:bg-[#d1b464] transition-colors border border-white/20 backdrop-blur-xs opacity-80 group-hover:opacity-100"
                    aria-label="次へ"
                  >
                    ›
                  </button>

                  {/* 下部ドットインジケーター */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                    {campaignList.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className={`h-2 rounded-full transition-all ${
                          currentIndex === idx
                            ? 'w-6 bg-[#d1b464]'
                            : 'w-2 bg-white/60 hover:bg-white'
                        }`}
                        aria-label={`スライド ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
