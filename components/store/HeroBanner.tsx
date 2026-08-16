'use client';

import React from 'react';
import { Campaign, StoreConfig } from '../../types/store';
import { HeroBannerSlider } from './HeroBannerSlider';
import { SectionHeading } from './SectionHeading';
import { useInViewOnce } from './useInViewOnce';

interface SmartInfoCardProps {
  store: StoreConfig;
  isCyberTheme: boolean;
  primaryColor: string;
}

const SmartInfoCard: React.FC<SmartInfoCardProps> = ({ store, isCyberTheme, primaryColor }) => {
  const { ref, inView, mounted } = useInViewOnce<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`relative z-10 max-w-2xl mx-auto ${isCyberTheme ? 'cyber-card reveal px-6 py-7 space-y-3' : 'space-y-2'}`}
    >
      <div className={`text-xs sm:text-sm font-semibold tracking-widest ${isCyberTheme ? 'text-[#ffa8d8]' : 'text-stone-700'}`}>
        {isCyberTheme ? `🐾 ${store.catchphrase || 'メンズエステ'}` : (store.catchphrase || '赤羽・川口 メンズエステ')}<br />
        <span
          className={`inline-block text-xl sm:text-2xl font-bold tracking-widest leading-relaxed ${
            isCyberTheme
              ? `neon-text-pink font-cyber-display ${mounted ? (inView ? 'neon-flicker-in' : 'neon-flicker-pending') : ''}`
              : 'text-stone-900'
          }`}
        >
          {store.name}
        </span>
      </div>
      {isCyberTheme && (
        <div
          className={`neon-rule neon-rule-draw w-32 mx-auto ${inView ? 'is-in' : ''}`}
        />
      )}
      <div className={`text-xs tracking-widest ${isCyberTheme ? 'text-[#ded1ee]' : 'text-stone-600'}`}>
        📍 {store.accessInfo}
      </div>
      <div className="text-xs font-bold tracking-wider" style={{ color: isCyberTheme ? '#ffa8d8' : primaryColor }}>
        ⏰ {store.businessHours}
      </div>

      <div className="pt-2">
        <a
          href={`tel:${store.phoneNumber}`}
          style={{ backgroundColor: isCyberTheme ? undefined : primaryColor }}
          className={`inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3 text-xs sm:text-sm font-bold text-white tracking-widest group ${
            isCyberTheme
              ? 'rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8]'
              : 'rounded-sm shadow-md hover:brightness-110 transition-all'
          }`}
        >
          <span className="text-base group-hover:scale-110 transition-transform">📞</span> お店に電話する ({store.phoneNumber})
        </a>
      </div>
    </div>
  );
};

interface HeroBannerProps {
  campaigns: Campaign[];
  store: StoreConfig;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ campaigns, store }) => {
  const primaryColor = store.themeColor?.primary || '#d1b464';
  const isCyberTheme = store.slug === 'onyankospa';

  // ループの始まりはHERO画像（isRevealed=true）。しばらく表示した後、
  // 一瞬だけネオンサインのロゴ点灯演出を挟んでから、また画像に戻る。
  const [isRevealed, setIsRevealed] = React.useState(true);

  React.useEffect(() => {
    if (!isCyberTheme) return;

    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const runLoop = () => {
      if (!isMounted) return;
      // 1. メインビジュアル画像表示 (5.5秒)
      setIsRevealed(true);

      timeoutId = setTimeout(() => {
        if (!isMounted) return;
        // 2. ネオンサイン点灯表示 (0.8秒)
        setIsRevealed(false);

        timeoutId = setTimeout(() => {
          // 再びループ（画像へ）
          runLoop();
        }, 800);
      }, 5500);
    };

    runLoop();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [isCyberTheme]);

  return (
    <div className={isCyberTheme ? 'text-[#f4eefa] relative overflow-hidden' : 'font-serif bg-[#faf9f5]'}>
      {/* 0. おニャンこスパ用 公式メインビジュアル 1枚限定・フレームなし画面全幅表示 */}
      {isCyberTheme && (
        <section className="relative w-full overflow-hidden border-b border-[#ff6fb5]/25 py-0">
          {/* 背景ネオンオーロラ・アトモスピアー（間接照明） */}
          <div className="neon-orb neon-orb-pink animate-orb-slow w-[36rem] h-[36rem] -top-40 -left-40" />
          <div className="neon-orb neon-orb-purple animate-orb-slower w-[32rem] h-[32rem] -bottom-40 -right-32" />

          {/* 画面幅いっぱいのメインビジュアルコンテナ (フレーム枠線・角丸なし) */}
          <div className="relative z-10 w-full">
            <div className="relative aspect-[16/10] sm:aspect-[16/9] lg:h-[82vh] w-full overflow-hidden group bg-[#0d0914]">
              
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

              {/* 枠内ネオンスパーク点灯演出 (画像表示の合間に一瞬だけ挟む) */}
              {!isRevealed && (
                <div className="absolute inset-0 z-30 cyber-bg flex flex-col items-center justify-center p-4 animate-glitch-intro">
                  <span className="neon-script text-3xl sm:text-5xl leading-tight pb-1 mb-1" aria-hidden="true">
                    Onyanko Spa
                  </span>
                  <div className="font-cyber-display text-3xl sm:text-5xl font-extrabold neon-text-pink tracking-widest">
                    🐾 おニャンこスパ 🐾
                  </div>
                  <div className="neon-rule w-56 mt-4" />
                  <span className="text-[10px] sm:text-xs text-[#ffa8d8] font-bold tracking-[0.4em] mt-3 animate-pulse">
                    CYBER NEON SPA
                  </span>
                </div>
              )}

              {/* レトロサイバー走査線 (Scanline effect) */}
              <div className="absolute inset-0 z-20 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0)_50%,rgba(62,20,70,0.18)_50%)] bg-[length:100%_4px] opacity-30" />

              {/* ネオン光粒子パーティクル */}
              <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
                <div className="absolute bottom-0 left-[15%] w-2.5 h-2.5 bg-[#ff6fb5] rounded-full blur-[1px] animate-particle-1" />
                <div className="absolute bottom-0 left-[45%] w-3 h-3 bg-[#ffa8d8] rounded-full blur-[2px] animate-particle-2" />
                <div className="absolute bottom-0 left-[75%] w-2 h-2 bg-pink-300 rounded-full blur-[1px] animate-particle-3" />
                <div className="absolute bottom-0 left-[85%] w-3.5 h-3.5 bg-[#ff6fb5] rounded-full blur-[2px] animate-particle-1" />
              </div>

              {/* シネマティックグラデーション（下端を淡いライラックに溶かし、ネオンの残光を重ねる） */}
              <div className="absolute inset-0 z-20 bg-gradient-to-t from-[#130a1c]/80 via-transparent to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-1/3 z-20 bg-gradient-to-t from-[#ff6fb5]/30 via-[#cf82d8]/12 to-transparent pointer-events-none" />

              {/* 左下・メインロックアップ（筆記体アクセント＋店名＋アクセス）
                  オープニング演出中は隠して、メインビジュアル表示と同時にフェードインさせる */}
              <div
                className={`absolute bottom-6 left-4 sm:left-10 z-30 max-w-[85%] sm:max-w-xl transition-all duration-1000 ${
                  isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                }`}
              >
                <span className="neon-script-white block text-2xl sm:text-4xl leading-tight pb-0.5" aria-hidden="true">
                  Onyanko Spa
                </span>
                <h1 className="font-cyber-display text-xl sm:text-3xl font-extrabold neon-text-white tracking-[0.14em]">
                  {store.name}
                </h1>
                <div className="neon-rule w-32 sm:w-48 my-2.5" />
                <p className="text-[10px] sm:text-xs text-white/90 tracking-[0.18em] font-medium drop-shadow-[0_1px_6px_rgba(62,20,70,0.9)]">
                  {store.accessInfo}
                </p>
              </div>
            </div>

            {/* Tokyo Panic風 3連クイックアクションナビゲーションバー (メインビジュアル直下) */}
            <div className="max-w-5xl mx-auto my-5 px-2 sm:px-4">
              <div className="cyber-card grid grid-cols-3 gap-1.5 sm:gap-2 p-1.5 rounded-2xl">
              {/* 1. セラピスト一覧 */}
              <a
                href={`/${store.slug}/therapists`}
                className="flex flex-col items-center justify-center py-3 sm:py-4 px-2 rounded-xl bg-gradient-to-br from-[#ff6fb5] to-[#ff9fdd] text-white active:scale-95 neon-glow-btn group"
              >
                <span className="text-xs sm:text-sm font-extrabold tracking-wider group-hover:scale-105 transition-transform">
                  セラピスト
                </span>
                <span className="text-[9px] sm:text-[10px] font-extrabold text-white/90 tracking-[0.25em] uppercase">
                  THERAPIST
                </span>
              </a>

              {/* 2. 出勤スケジュール */}
              <a
                href={`/${store.slug}/schedule`}
                className="flex flex-col items-center justify-center py-3 sm:py-4 px-2 rounded-xl bg-gradient-to-br from-[#ff6fb5] to-[#cf82d8] text-white active:scale-95 neon-glow-btn group"
              >
                <span className="text-xs sm:text-sm font-extrabold tracking-wider group-hover:scale-105 transition-transform">
                  スケジュール
                </span>
                <span className="text-[9px] sm:text-[10px] font-extrabold text-white/90 tracking-[0.25em] uppercase">
                  SCHEDULE
                </span>
              </a>

              {/* 3. お電話直通 */}
              <a
                href={`tel:${store.phoneNumber}`}
                className="flex flex-col items-center justify-center py-3 sm:py-4 px-2 rounded-xl bg-gradient-to-br from-[#ff4fa3] via-[#ff6fb5] to-[#cf82d8] text-white active:scale-95 neon-glow-btn group"
              >
                <div className="flex items-center gap-1 group-hover:scale-105 transition-transform">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]" viewBox="0 0 24 24">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                  <span className="text-xs sm:text-sm font-extrabold tracking-wider text-white">
                    お電話
                  </span>
                </div>
                <span className="text-[9px] sm:text-[10px] font-extrabold text-white/90 tracking-widest uppercase">
                  CALL NOW
                </span>
              </a>
            </div>
          </div>
          </div>
        </section>
      )}

      {/* 1. smart-info (店舗概要・お電話案内) */}
      <section className={`relative overflow-hidden py-8 px-4 border-b text-center ${
        isCyberTheme ? 'border-[#ff6fb5]/20' : 'bg-white/95 border-stone-200 shadow-xs'
      }`}>
        {isCyberTheme && (
          <div className="neon-orb neon-orb-magenta animate-orb-slow w-[22rem] h-[22rem] -top-32 left-1/2 -translate-x-1/2" />
        )}
        <SmartInfoCard store={store} isCyberTheme={isCyberTheme} primaryColor={primaryColor} />
      </section>



      {/* 3. Information (イベント・キャンペーン極上スライダー) */}
      {campaigns && campaigns.length > 0 && (
        <section className={`relative overflow-hidden py-14 border-b ${
          isCyberTheme ? 'border-[#ff6fb5]/20' : 'bg-white border-stone-200'
        }`}>
          {isCyberTheme && (
            <div className="neon-orb neon-orb-purple animate-orb-slower w-[26rem] h-[26rem] -bottom-40 -left-28" />
          )}
          <div className="relative z-10 max-w-4xl mx-auto px-4 space-y-8">
            <SectionHeading title="Information" subtitle="インフォメーション" isCyber={isCyberTheme} />

            {/* 極上フェードスライダー */}
            <HeroBannerSlider campaigns={campaigns} isCyber={isCyberTheme} />
          </div>
        </section>
      )}
    </div>
  );
};
