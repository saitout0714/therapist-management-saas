'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

interface CyberParallaxBackgroundProps {
  variant?: 'full' | 'medium' | 'mild';
  pageType?: 'therapists' | 'diary' | 'system' | 'schedule' | 'access' | 'recruit';
}

export const CyberParallaxBackground: React.FC<CyberParallaxBackgroundProps> = ({
  variant = 'full',
  pageType,
}) => {
  const [scrollY, setScrollY] = useState(0);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

  /*
   * TOPページの背景は5層あるが、以前は全層をいきなりDOMに載せていたため、
   * 表示していない3枚分の背景画像まで初期ロードで取りに行き、
   * メインビジュアル(LCP画像)の帯域を奪ってLCPが20秒台まで悪化していた。
   * 実際に到達した層と、その次の層だけを載せることで初期転送量を抑える。
   * 「次の層」を先に載せるのは、切り替え時のフェードを維持するため。
   */
  const [loadedSections, setLoadedSections] = useState<number[]>([0]);
  const activeSectionIndexRef = useRef(0);
  // 次の層の先読みはページのロード完了後に解禁する（LCP画像の取得を邪魔しない）。
  const canPrefetchNextRef = useRef(false);

  const markLoaded = useCallback((index: number) => {
    setLoadedSections((prev) => {
      const next = new Set(prev);
      next.add(index);
      if (canPrefetchNextRef.current) next.add(index + 1);
      return next.size === prev.length ? prev : Array.from(next);
    });
  }, []);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY;
          setScrollY(currentY);

          if (variant === 'full') {
            const pageHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (pageHeight > 0) {
              const progress = currentY / pageHeight;
              const index =
                progress < 0.08 ? 0 // Main Visual (ピンク)
                : progress < 0.35 ? 1 // Therapists (エレクトリックブルー)
                : progress < 0.58 ? 2 // Diary (シャンパンゴールド)
                : progress < 0.80 ? 3 // System / Topics (プラチナホワイト)
                : 4; // Concept / Access (フルカラーオーロラ)
              activeSectionIndexRef.current = index;
              setActiveSectionIndex(index);
              markLoaded(index);
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [variant, markLoaded]);

  useEffect(() => {
    if (variant !== 'full') return;
    let timeoutId: ReturnType<typeof setTimeout>;
    const start = () => {
      timeoutId = setTimeout(() => {
        canPrefetchNextRef.current = true;
        markLoaded(activeSectionIndexRef.current);
      }, 300);
    };
    if (document.readyState === 'complete') {
      start();
    } else {
      window.addEventListener('load', start, { once: true });
    }
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('load', start);
    };
  }, [variant, markLoaded]);

  // 下層ページ用の背景画像決定
  const getSubpageBgImage = () => {
    if (pageType === 'therapists') return '/images/onyanko_bg_therapist.webp'; // エレクトリックブルー
    if (pageType === 'diary') return '/images/onyanko_bg_diary.webp'; // シャンパンゴールド
    if (pageType === 'system' || pageType === 'schedule') return '/images/onyanko_bg_system.webp'; // プラチナホワイト
    return '/images/onyanko_bg_hero.webp'; // ピンク・サイバー
  };

  // 下層ページ用のテーマオーブカラー決定
  const getSubpageOrbColor = () => {
    if (pageType === 'therapists') return 'rgba(0, 210, 255, 0.7)'; // ブルー
    if (pageType === 'diary') return 'rgba(255, 215, 0, 0.7)'; // ゴールド
    if (pageType === 'system' || pageType === 'schedule') return 'rgba(255, 255, 255, 0.75)'; // ホワイト
    return 'rgba(255, 111, 181, 0.75)'; // ピンク
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* ── 0. 漆黒ベース背景 ── */}
      <div className="absolute inset-0 bg-[#040208]" />

      {/* ── 1. 下層ページ用メインビジュアル背景 (variant !== 'full' の時もしっかり濃く表示) ── */}
      {variant !== 'full' && (
        <div className="absolute inset-0 opacity-42 transition-opacity duration-700 ease-in-out">
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-100 ease-out"
            style={{
              backgroundImage: `url('${getSubpageBgImage()}')`,
              transform: `translate3d(0, ${scrollY * -0.06}px, 0) scale(1.06)`,
              filter: 'brightness(0.7) contrast(1.15) saturate(1.25)',
            }}
          />
        </div>
      )}

      {/* ── 2. TOPページ用動的背景レイヤー (variant === 'full') ── */}
      {variant === 'full' && (
        <>
          {/* Hero背景 (Index 0) */}
          {loadedSections.includes(0) && (
            <div
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                activeSectionIndex === 0 ? 'opacity-45' : 'opacity-0'
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-200 ease-out"
                style={{
                  backgroundImage: `url('/images/onyanko_bg_hero.webp')`,
                  transform: `translate3d(0, ${scrollY * -0.06}px, 0) scale(1.05)`,
                  filter: 'brightness(0.72) contrast(1.15) saturate(1.25)',
                }}
              />
            </div>
          )}

          {/* セラピスト背景 (Index 1) */}
          {loadedSections.includes(1) && (
            <div
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                activeSectionIndex === 1 ? 'opacity-42' : 'opacity-0'
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-200 ease-out"
                style={{
                  backgroundImage: `url('/images/onyanko_bg_therapist.webp')`,
                  transform: `translate3d(0, ${scrollY * -0.05}px, 0) scale(1.05)`,
                  filter: 'brightness(0.72) contrast(1.15) saturate(1.25)',
                }}
              />
            </div>
          )}

          {/* 写メ日記背景 (Index 2) */}
          {loadedSections.includes(2) && (
            <div
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                activeSectionIndex === 2 ? 'opacity-45' : 'opacity-0'
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-200 ease-out"
                style={{
                  backgroundImage: `url('/images/onyanko_bg_diary.webp')`,
                  transform: `translate3d(0, ${scrollY * -0.06}px, 0) scale(1.06)`,
                  filter: 'brightness(0.7) contrast(1.2) saturate(1.25)',
                }}
              />
            </div>
          )}

          {/* System背景 (Index 3) */}
          {loadedSections.includes(3) && (
            <div
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                activeSectionIndex === 3 ? 'opacity-40' : 'opacity-0'
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-200 ease-out"
                style={{
                  backgroundImage: `url('/images/onyanko_bg_system.webp')`,
                  transform: `translate3d(0, ${scrollY * -0.05}px, 0) scale(1.05)`,
                  filter: 'brightness(0.72) contrast(1.15) saturate(1.15)',
                }}
              />
            </div>
          )}

          {/* Access背景 (Index 4) */}
          <div
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              activeSectionIndex === 4 ? 'opacity-42' : 'opacity-0'
            }`}
            style={{
              background:
                'radial-gradient(circle at 20% 30%, rgba(255, 111, 181, 0.4) 0%, transparent 55%), radial-gradient(circle at 80% 30%, rgba(0, 210, 255, 0.4) 0%, transparent 55%), radial-gradient(circle at 50% 80%, rgba(255, 215, 0, 0.35) 0%, transparent 55%)',
            }}
          />
        </>
      )}

      {/* ── 3. 鮮やかな発光ネオンオーブ (下層ページでもくっきり発光 opacity 48%) ── */}
      <div
        className="absolute -top-20 -left-20 w-[45vw] h-[45vw] max-w-[550px] max-h-[550px] rounded-full filter blur-[85px] opacity-48 transition-all duration-1000 ease-in-out pointer-events-none"
        style={{
          background:
            variant !== 'full'
              ? `radial-gradient(circle, ${getSubpageOrbColor()} 0%, transparent 70%)`
              : activeSectionIndex === 0
              ? 'radial-gradient(circle, rgba(255, 111, 181, 0.7) 0%, transparent 70%)'
              : activeSectionIndex === 1
              ? 'radial-gradient(circle, rgba(0, 210, 255, 0.7) 0%, transparent 70%)'
              : activeSectionIndex === 2
              ? 'radial-gradient(circle, rgba(255, 215, 0, 0.7) 0%, transparent 70%)'
              : activeSectionIndex === 3
              ? 'radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(255, 111, 181, 0.6) 0%, transparent 70%)',
          transform: `translate3d(0, ${scrollY * 0.2}px, 0)`,
        }}
      />

      <div
        className="absolute top-[40vh] -right-24 w-[48vw] h-[48vw] max-w-[600px] max-h-[600px] rounded-full filter blur-[90px] opacity-42 transition-all duration-1000 ease-in-out pointer-events-none"
        style={{
          background:
            variant !== 'full'
              ? 'radial-gradient(circle, rgba(207, 130, 216, 0.6) 0%, transparent 70%)'
              : activeSectionIndex === 0
              ? 'radial-gradient(circle, rgba(207, 130, 216, 0.65) 0%, transparent 70%)'
              : activeSectionIndex === 1
              ? 'radial-gradient(circle, rgba(0, 150, 255, 0.65) 0%, transparent 70%)'
              : activeSectionIndex === 2
              ? 'radial-gradient(circle, rgba(255, 160, 0, 0.65) 0%, transparent 70%)'
              : activeSectionIndex === 3
              ? 'radial-gradient(circle, rgba(220, 245, 255, 0.7) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(0, 210, 255, 0.6) 0%, transparent 70%)',
          transform: `translate3d(0, ${scrollY * -0.15}px, 0)`,
        }}
      />

      {/* ── 4. 全ページ共通・くっきり浮かび上がる白レンガ壁テクスチャ (前面透過表示 opacity 50%) ── */}
      <div
        className="absolute inset-0 opacity-50 mix-blend-screen transition-transform duration-100 ease-out"
        style={{
          backgroundImage: `var(--brick-texture)`,
          backgroundRepeat: 'repeat',
          backgroundSize: '120px 60px',
          transform: `translate3d(0, ${scrollY * 0.15}px, 0)`,
          filter: 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.35))',
        }}
      />

      {/* ── 5. 煌めく舞い上がる微細粒子スパークル ── */}
      <div className="absolute inset-0 opacity-55">
        <div
          className="absolute top-[12%] left-[12%] w-2 h-2 rounded-full animate-sparkle transition-colors duration-700"
          style={{
            backgroundColor: pageType === 'therapists' ? '#00f0ff' : pageType === 'diary' ? '#ffd700' : pageType === 'system' ? '#ffffff' : '#ff6fb5',
            boxShadow: `0 0 12px ${pageType === 'therapists' ? '#00f0ff' : pageType === 'diary' ? '#ffd700' : pageType === 'system' ? '#ffffff' : '#ff6fb5'}`,
          }}
        />
        <div
          className="absolute top-[28%] left-[82%] w-2.5 h-2.5 rounded-full animate-sparkle transition-colors duration-700"
          style={{
            animationDelay: '1s',
            backgroundColor: pageType === 'therapists' ? '#00bfff' : pageType === 'diary' ? '#ffae00' : pageType === 'system' ? '#e0f7fa' : '#cf82d8',
            boxShadow: `0 0 14px ${pageType === 'therapists' ? '#00bfff' : pageType === 'diary' ? '#ffae00' : pageType === 'system' ? '#e0f7fa' : '#cf82d8'}`,
          }}
        />
        <div
          className="absolute top-[68%] left-[75%] w-2.5 h-2.5 rounded-full animate-sparkle transition-colors duration-700"
          style={{
            animationDelay: '1.8s',
            backgroundColor: pageType === 'system' ? '#ffffff' : pageType === 'diary' ? '#ffd700' : pageType === 'therapists' ? '#00f0ff' : '#ff6fb5',
            boxShadow: `0 0 16px ${pageType === 'system' ? '#ffffff' : pageType === 'diary' ? '#ffd700' : pageType === 'therapists' ? '#00f0ff' : '#ff6fb5'}`,
          }}
        />
      </div>
    </div>
  );
};
