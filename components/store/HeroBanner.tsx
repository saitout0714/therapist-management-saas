'use client';

import React from 'react';
import { Campaign, StoreConfig } from '../../types/store';
import { HeroBannerSlider } from './HeroBannerSlider';

interface HeroBannerProps {
  campaigns: Campaign[];
  store: StoreConfig;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ campaigns, store }) => {
  const primaryColor = store.themeColor?.primary || '#d1b464';

  return (
    <div className="font-serif bg-[#faf9f5]">
      {/* 1. smart-info (店舗概要・お電話案内) */}
      <section className="bg-white/95 py-6 px-4 border-b border-stone-200 text-center shadow-xs">
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
          <div className="text-xs font-medium tracking-wider" style={{ color: primaryColor }}>
            {store.businessHours}
          </div>

          <div className="pt-2">
            <a
              href={`tel:${store.phoneNumber}`}
              style={{ backgroundColor: primaryColor }}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3 text-xs sm:text-sm font-bold text-white rounded-sm shadow-md hover:brightness-110 transition-all tracking-widest group"
            >
              <span className="text-base group-hover:scale-110 transition-transform">📞</span> お店に電話する ({store.phoneNumber})
            </a>
          </div>
        </div>
      </section>

      {/* 2. トップコンセプト */}
      <section className="bg-[#faf7f0] py-8 px-4 border-b border-stone-200 text-center">
        <div className="max-w-3xl mx-auto space-y-2">
          <h2 className="text-lg sm:text-xl font-bold text-stone-800 tracking-widest">
            赤羽・川口のメンズエステ<br />
            <span className="block text-xs sm:text-sm font-normal mt-1 tracking-widest" style={{ color: primaryColor }}>
              Special Grade ～上質で優雅な至福の空間～
            </span>
          </h2>
          <p className="text-xs text-stone-600 leading-relaxed tracking-wider pt-2 max-w-2xl mx-auto">
            最高級をお求めのお客様のために「技術」「ルックス」「性格」の三点を厳選して日本人女性を採用。
            上質で優雅な至福の空間をどうぞご堪能ください。
          </p>
        </div>
      </section>

      {/* 3. Information (イベント・キャンペーン極上スライダー) */}
      {campaigns && campaigns.length > 0 && (
        <section className="bg-white py-8 border-b border-stone-200">
          <div className="max-w-4xl mx-auto px-4 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-stone-800 tracking-widest">Information</h2>
              <span className="inline-block text-xs border-t border-stone-800 px-4 pt-1 mt-1 tracking-widest" style={{ color: primaryColor }}>
                インフォメーション
              </span>
            </div>

            {/* 極上フェードスライダー */}
            <HeroBannerSlider campaigns={campaigns} />
          </div>
        </section>
      )}
    </div>
  );
};
