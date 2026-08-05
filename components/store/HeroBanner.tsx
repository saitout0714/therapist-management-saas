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

  const [isRevealed, setIsRevealed] = React.useState(false);

  React.useEffect(() => {
    if (!isCyberTheme) return;

    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const runLoop = () => {
      if (!isMounted) return;
      // 1. ネオンサイン点灯表示 (0.8秒)
      setIsRevealed(false);

      timeoutId = setTimeout(() => {
        if (!isMounted) return;
        // 2. メインビジュアル画像表示 (5.5秒)
        setIsRevealed(true);

        timeoutId = setTimeout(() => {
          // 再びループ
          runLoop();
        }, 5500);
      }, 800);
    };

    runLoop();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [isCyberTheme]);

  return (
    <div className={isCyberTheme ? 'font-sans cyber-bg text-white relative overflow-hidden' : 'font-serif bg-[#faf9f5]'}>
      {/* 0. おニャンこスパ用 公式メインビジュアル 1枚限定・フレームなし画面全幅表示 */}
      {isCyberTheme && (
        <section className="relative w-full overflow-hidden bg-[#050014] border-b border-[#ff007f]/40 py-0">
          {/* 背景ネオンオーロラ・アトモスピアー */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[#ff007f]/15 blur-[120px] rounded-full pointer-events-none" />

          {/* 画面幅いっぱいのメインビジュアルコンテナ (フレーム枠線・角丸なし) */}
          <div className="w-full">
            <div className="relative aspect-[16/10] sm:aspect-[16/9] lg:h-[82vh] w-full overflow-hidden group bg-[#050014]">
              
              {/* 公式メインビジュアル (横幅いっぱい全幅表示) */}
              <div
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                  isRevealed ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                }`}
              >
                <img
                  src="/images/onyanko_mainvisual.jpg"
                  alt="おニャンこスパ メインビジュアル"
                  className="w-full h-full object-cover object-center animate-ken-burns transform group-hover:scale-103 transition-transform duration-1000"
                />
              </div>

              {/* 枠内ネオンスパーク点灯演出 (0.8秒ループ) */}
              {!isRevealed && (
                <div className="absolute inset-0 z-30 bg-[#050014] flex flex-col items-center justify-center p-4 animate-glitch-intro">
                  <div className="text-4xl sm:text-6xl font-extrabold text-[#ff007f] drop-shadow-[0_0_30px_#ff007f] tracking-widest">
                    🐾 おニャンこスパ 🐾
                  </div>
                  <span className="text-xs sm:text-sm text-pink-300 font-bold tracking-widest mt-3 animate-pulse">
                    〜 CYBER NEON SPA 〜
                  </span>
                </div>
              )}

              {/* レトロサイバー走査線 (Scanline effect) */}
              <div className="absolute inset-0 z-20 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-40" />

              {/* ネオン光粒子パーティクル */}
              <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
                <div className="absolute bottom-0 left-[15%] w-2.5 h-2.5 bg-[#ff007f] rounded-full blur-[1px] animate-particle-1" />
                <div className="absolute bottom-0 left-[45%] w-3 h-3 bg-[#ff2a8d] rounded-full blur-[2px] animate-particle-2" />
                <div className="absolute bottom-0 left-[75%] w-2 h-2 bg-pink-300 rounded-full blur-[1px] animate-particle-3" />
                <div className="absolute bottom-0 left-[85%] w-3.5 h-3.5 bg-[#ff007f] rounded-full blur-[2px] animate-particle-1" />
              </div>

              {/* シネマティックグラデーション */}
              <div className="absolute inset-0 z-20 bg-gradient-to-t from-[#050014]/90 via-transparent to-[#050014]/30 pointer-events-none" />

              {/* 左上・ガラスモルフィズム ネオンタグ */}
              <div className="absolute top-3 left-4 z-30 hidden sm:flex items-center gap-2 bg-[#050014]/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#ff007f]/50 shadow-[0_0_12px_rgba(255,0,127,0.4)]">
                <span className="w-2 h-2 rounded-full bg-[#ff007f] animate-ping" />
                <span className="text-[11px] font-extrabold text-white tracking-widest">
                  🐾 SHINJUKU & SHIBUYA CYBER SPA
                </span>
              </div>

              {/* 右下・ガラスモルフィズム 公式マーク */}
              <div className="absolute bottom-3 right-4 z-30 flex items-center gap-2 bg-[#050014]/85 backdrop-blur-md px-4 py-1.5 rounded-full border border-[#ff007f]/60 shadow-[0_0_15px_rgba(255,0,127,0.5)]">
                <span className="text-[11px] font-extrabold neon-text-pink tracking-widest">
                  ★ OFFICIAL MAIN VISUAL
                </span>
              </div>
            </div>

            {/* Tokyo Panic風 3連クイックアクションナビゲーションバー (メインビジュアル直下) */}
            <div className="max-w-5xl mx-auto my-3 px-2 sm:px-4">
              <div className="grid grid-cols-3 gap-1 sm:gap-2 bg-[#050014] p-1 rounded-xl sm:rounded-2xl border border-[#ff007f]/50 shadow-[0_0_25px_rgba(255,0,127,0.4)]">
              {/* 1. セラピスト一覧 */}
              <a
                href={`/${store.slug}/therapists`}
                className="flex flex-col items-center justify-center py-2.5 sm:py-3.5 px-2 rounded-lg bg-gradient-to-br from-[#ff007f] to-[#ff2a8d] text-white hover:brightness-110 active:scale-95 transition-all shadow-[0_0_12px_rgba(255,0,127,0.5)] group"
              >
                <span className="text-xs sm:text-sm font-extrabold tracking-wider group-hover:scale-105 transition-transform">
                  セラピスト
                </span>
                <span className="text-[9px] sm:text-[10px] font-semibold text-pink-100 tracking-widest uppercase">
                  THERAPIST
                </span>
              </a>

              {/* 2. 出勤スケジュール */}
              <a
                href={`/${store.slug}/schedule`}
                className="flex flex-col items-center justify-center py-2.5 sm:py-3.5 px-2 rounded-lg bg-gradient-to-br from-[#ff2a8d] to-[#1a0933] text-white hover:brightness-110 active:scale-95 transition-all shadow-[0_0_12px_rgba(255,0,127,0.4)] border border-[#ff007f]/40 group"
              >
                <span className="text-xs sm:text-sm font-extrabold tracking-wider group-hover:scale-105 transition-transform">
                  スケジュール
                </span>
                <span className="text-[9px] sm:text-[10px] font-semibold text-pink-200 tracking-widest uppercase">
                  SCHEDULE
                </span>
              </a>

              {/* 3. お電話直通 */}
              <a
                href={`tel:${store.phoneNumber}`}
                className="flex flex-col items-center justify-center py-2.5 sm:py-3.5 px-2 rounded-lg bg-gradient-to-br from-[#ff007f] via-[#ff2a8d] to-[#c7005c] text-white hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,0,127,0.7)] border border-pink-400/50 animate-neon-pulse group"
              >
                <div className="flex items-center gap-1 group-hover:scale-105 transition-transform">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                  <span className="text-xs sm:text-sm font-extrabold tracking-wider text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
                    お電話
                  </span>
                </div>
                <span className="text-[9px] sm:text-[10px] font-extrabold text-pink-100 tracking-widest uppercase">
                  CALL NOW
                </span>
              </a>
            </div>
          </div>
          </div>
        </section>
      )}

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
          <div className="text-xs font-bold tracking-wider" style={{ color: isCyberTheme ? '#ff2a8d' : primaryColor }}>
            ⏰ {store.businessHours}
          </div>

          <div className="pt-2">
            <a
              href={`tel:${store.phoneNumber}`}
              style={{ backgroundColor: isCyberTheme ? '#ff007f' : primaryColor }}
              className={`inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:brightness-110 transition-all tracking-widest group ${
                isCyberTheme ? 'rounded-full shadow-[0_0_15px_rgba(255,0,127,0.6)] animate-neon-pulse' : 'rounded-sm'
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
