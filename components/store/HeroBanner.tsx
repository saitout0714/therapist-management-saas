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
  const isCyberTheme = store.slug === 'onyankospa';

  return (
    <div className={isCyberTheme ? 'font-sans cyber-bg text-white' : 'font-serif bg-[#faf9f5]'}>
      {/* 1. smart-info (店舗概要・お電話案内) */}
      <section className={`py-6 px-4 border-b text-center shadow-xs ${
        isCyberTheme ? 'bg-[#050014]/90 border-[#ff007f]/30' : 'bg-white/95 border-stone-200'
      }`}>
        <div className="max-w-2xl mx-auto space-y-2">
          <div className={`text-xs sm:text-sm font-semibold tracking-widest ${isCyberTheme ? 'text-pink-200' : 'text-stone-700'}`}>
            {isCyberTheme ? '🐾 新宿・渋谷エリア メンズエステ' : '赤羽・川口 メンズエステ'}<br />
            <span className={`text-xl sm:text-2xl font-bold tracking-widest leading-relaxed ${
              isCyberTheme ? 'neon-text-pink animate-neon-pulse' : 'text-stone-900'
            }`}>
              {store.name}
            </span>
          </div>
          <div className={`text-xs tracking-widest ${isCyberTheme ? 'text-pink-100' : 'text-stone-600'}`}>
            📍 {store.accessInfo}
          </div>
          <div className="text-xs font-bold tracking-wider" style={{ color: primaryColor }}>
            ⏰ {store.businessHours}
          </div>

          <div className="pt-2">
            <a
              href={`tel:${store.phoneNumber}`}
              style={{ backgroundColor: primaryColor }}
              className={`inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:brightness-110 transition-all tracking-widest group ${
                isCyberTheme ? 'rounded-full shadow-[0_0_15px_rgba(255,0,127,0.6)]' : 'rounded-sm'
              }`}
            >
              <span className="text-base group-hover:scale-110 transition-transform">📞</span> お店に電話する ({store.phoneNumber})
            </a>
          </div>
        </div>
      </section>

      {/* 2. トップコンセプト */}
      <section className={`py-8 px-4 border-b text-center ${
        isCyberTheme ? 'bg-[#1a0933]/50 border-[#ff007f]/20' : 'bg-[#faf7f0] border-stone-200'
      }`}>
        <div className="max-w-3xl mx-auto space-y-2">
          <h2 className={`text-lg sm:text-xl font-bold tracking-widest ${isCyberTheme ? 'text-white' : 'text-stone-800'}`}>
            {isCyberTheme ? '新宿・渋谷 メンズエステ' : '赤羽・川口のメンズエステ'}<br />
            <span className={`block text-xs sm:text-sm font-normal mt-1 tracking-widest ${
              isCyberTheme ? 'neon-text-pink font-bold' : ''
            }`} style={{ color: isCyberTheme ? undefined : primaryColor }}>
              {store.name} ～{store.catchphrase}～
            </span>
          </h2>
          <p className={`text-xs leading-relaxed tracking-wider pt-2 max-w-2xl mx-auto ${
            isCyberTheme ? 'text-pink-100' : 'text-stone-600'
          }`}>
            {isCyberTheme
              ? 'ネオン輝く完全プライベート個室空間で、キュートな猫耳セラピストが身も心もとろける極上アロマを提供します。'
              : '最高級をお求めのお客様のために「技術」「ルックス」「性格」の三点を厳選して日本人女性を採用。上質で優雅な至福の空間をどうぞご堪能ください。'}
          </p>
        </div>
      </section>

      {/* 3. Information (イベント・キャンペーン極上スライダー) */}
      {campaigns && campaigns.length > 0 && (
        <section className={`py-8 border-b ${
          isCyberTheme ? 'bg-[#050014] border-[#ff007f]/30' : 'bg-white border-stone-200'
        }`}>
          <div className="max-w-4xl mx-auto px-4 space-y-6">
            <div className="text-center">
              <h2 className={`text-2xl font-bold tracking-widest ${isCyberTheme ? 'neon-text-pink' : 'text-stone-800'}`}>Information</h2>
              <span className={`inline-block text-xs border-t px-4 pt-1 mt-1 tracking-widest ${
                isCyberTheme ? 'text-[#ff2a8d] border-[#ff007f]' : 'border-stone-800'
              }`} style={{ color: isCyberTheme ? undefined : primaryColor }}>
                インフォメーション
              </span>
            </div>

            {/* 極上フェードスライダー */}
            <HeroBannerSlider campaigns={campaigns} isCyber={isCyberTheme} />
          </div>
        </section>
      )}
    </div>
  );
};
