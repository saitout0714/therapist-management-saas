'use client';

import React, { useEffect, useState } from 'react';

export const CyberParallaxBackground: React.FC = () => {
  const [scrollY, setScrollY] = useState(0);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY;
          setScrollY(currentY);

          // スクロール位置に応じたアクティブセクション判定
          const pageHeight = document.documentElement.scrollHeight - window.innerHeight;
          if (pageHeight > 0) {
            const progress = currentY / pageHeight;
            if (progress < 0.22) setActiveSectionIndex(0); // Hero (ピンク・マゼンタ)
            else if (progress < 0.45) setActiveSectionIndex(1); // Therapists (エレクトリックブルー)
            else if (progress < 0.65) setActiveSectionIndex(2); // Diary (シャンパンゴールド・イエロー)
            else if (progress < 0.85) setActiveSectionIndex(3); // News / System (プラチナホワイト)
            else setActiveSectionIndex(4); // Concept / Access (フルカラーオーロラ)
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* ── 0. ベース背景（漆黒ディープグラデーション） ── */}
      <div className="absolute inset-0 bg-[#040208]" />

      {/* ── 1. Hero背景 (Index 0: 🌸 ピンク＆マゼンタネオン) ── */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
          activeSectionIndex === 0 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-200 ease-out"
          style={{
            backgroundImage: `url('/images/onyanko_bg_hero.jpg')`,
            transform: `translate3d(0, ${scrollY * -0.08}px, 0) scale(1.06)`,
            filter: 'brightness(0.65) contrast(1.15) saturate(1.2)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 30%, rgba(255, 111, 181, 0.4) 0%, transparent 65%), linear-gradient(180deg, rgba(4, 2, 8, 0.7) 0%, rgba(14, 5, 28, 0.55) 50%, rgba(4, 2, 8, 0.85) 100%)',
          }}
        />
      </div>

      {/* ── 2. セラピスト背景 (Index 1: ⚡ エレクトリックブルーネオン) ── */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
          activeSectionIndex === 1 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-200 ease-out"
          style={{
            backgroundImage: `url('/images/onyanko_bg_therapist.jpg')`,
            transform: `translate3d(0, ${scrollY * -0.06}px, 0) scale(1.05)`,
            filter: 'brightness(0.65) contrast(1.15) saturate(1.3)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 80% 40%, rgba(0, 210, 255, 0.45) 0%, transparent 65%), linear-gradient(180deg, rgba(2, 8, 16, 0.75) 0%, rgba(4, 15, 32, 0.6) 50%, rgba(2, 8, 16, 0.85) 100%)',
          }}
        />
      </div>

      {/* ── 3. 写メ日記背景 (Index 2: ✨ シャンパンゴールド＆イエローネオン) ── */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
          activeSectionIndex === 2 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-200 ease-out"
          style={{
            backgroundImage: `url('/images/onyanko_bg_diary.jpg')`,
            transform: `translate3d(0, ${scrollY * -0.08}px, 0) scale(1.08)`,
            filter: 'brightness(0.6) contrast(1.2) saturate(1.3)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 30% 50%, rgba(255, 215, 0, 0.45) 0%, transparent 65%), linear-gradient(180deg, rgba(16, 12, 2, 0.75) 0%, rgba(32, 22, 4, 0.6) 50%, rgba(16, 12, 2, 0.85) 100%)',
          }}
        />
      </div>

      {/* ── 4. Topics / System背景 (Index 3: 💎 プラチナホワイト＆シルバー) ── */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
          activeSectionIndex === 3 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-200 ease-out"
          style={{
            backgroundImage: `url('/images/onyanko_bg_system.jpg')`,
            transform: `translate3d(0, ${scrollY * -0.06}px, 0) scale(1.05)`,
            filter: 'brightness(0.6) contrast(1.2) saturate(1.1)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 85% 30%, rgba(255, 255, 255, 0.4) 0%, transparent 60%), linear-gradient(180deg, rgba(6, 8, 12, 0.75) 0%, rgba(14, 18, 26, 0.6) 50%, rgba(6, 8, 12, 0.85) 100%)',
          }}
        />
      </div>

      {/* ── 5. Concept / Access背景 (Index 4: 🌈 フルカラーオーロラミックス) ── */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
          activeSectionIndex === 4 ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(circle at 20% 30%, rgba(255, 111, 181, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 30%, rgba(0, 210, 255, 0.3) 0%, transparent 50%), radial-gradient(circle at 50% 80%, rgba(255, 215, 0, 0.25) 0%, transparent 50%), linear-gradient(180deg, #030106 0%, #0c051a 50%, #020104 100%)',
        }}
      />

      {/* ── 6. 共通白レンガテクスチャ（パララックス視差移動 0.15倍） ── */}
      <div
        className="absolute inset-0 opacity-25 mix-blend-screen transition-transform duration-100 ease-out"
        style={{
          backgroundImage: `var(--brick-texture)`,
          backgroundRepeat: 'repeat',
          backgroundSize: '120px 60px',
          transform: `translate3d(0, ${scrollY * 0.15}px, 0)`,
        }}
      />

      {/* ── 7. 動的カラーチェンジ・ネオンオーブ (Orb 1: アクティブカラーに追従) ── */}
      <div
        className="absolute -top-20 -left-20 w-[45vw] h-[45vw] max-w-[600px] max-h-[600px] rounded-full filter blur-[80px] opacity-60 transition-all duration-1000 ease-in-out pointer-events-none"
        style={{
          background:
            activeSectionIndex === 0
              ? 'radial-gradient(circle, rgba(255, 111, 181, 0.75) 0%, transparent 70%)' // ピンク
              : activeSectionIndex === 1
              ? 'radial-gradient(circle, rgba(0, 210, 255, 0.75) 0%, transparent 70%)' // ブルー
              : activeSectionIndex === 2
              ? 'radial-gradient(circle, rgba(255, 215, 0, 0.75) 0%, transparent 70%)' // ゴールド・イエロー
              : activeSectionIndex === 3
              ? 'radial-gradient(circle, rgba(255, 255, 255, 0.75) 0%, transparent 70%)' // ホワイト
              : 'radial-gradient(circle, rgba(255, 111, 181, 0.6) 0%, transparent 70%)',
          transform: `translate3d(0, ${scrollY * 0.25}px, 0)`,
        }}
      />

      {/* ── 8. 動的カラーチェンジ・ネオンオーブ (Orb 2: セカンダリカラー) ── */}
      <div
        className="absolute top-[40vh] -right-24 w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] rounded-full filter blur-[90px] opacity-50 transition-all duration-1000 ease-in-out pointer-events-none"
        style={{
          background:
            activeSectionIndex === 0
              ? 'radial-gradient(circle, rgba(207, 130, 216, 0.7) 0%, transparent 70%)' // パープル
              : activeSectionIndex === 1
              ? 'radial-gradient(circle, rgba(0, 150, 255, 0.7) 0%, transparent 70%)' // シアン
              : activeSectionIndex === 2
              ? 'radial-gradient(circle, rgba(255, 160, 0, 0.7) 0%, transparent 70%)' // アンバー
              : activeSectionIndex === 3
              ? 'radial-gradient(circle, rgba(220, 245, 255, 0.75) 0%, transparent 70%)' // パール
              : 'radial-gradient(circle, rgba(0, 210, 255, 0.65) 0%, transparent 70%)',
          transform: `translate3d(0, ${scrollY * -0.18}px, 0)`,
        }}
      />

      {/* ── 9. 多彩な舞い上がるネオン光パーティクル (ピンク・ブルー・イエロー・ホワイト) ── */}
      <div className="absolute inset-0 opacity-70">
        <div
          className="absolute top-[12%] left-[12%] w-2.5 h-2.5 rounded-full animate-sparkle transition-colors duration-700"
          style={{
            backgroundColor: activeSectionIndex === 1 ? '#00f0ff' : activeSectionIndex === 2 ? '#ffd700' : activeSectionIndex === 3 ? '#ffffff' : '#ff6fb5',
            boxShadow: `0 0 14px ${activeSectionIndex === 1 ? '#00f0ff' : activeSectionIndex === 2 ? '#ffd700' : activeSectionIndex === 3 ? '#ffffff' : '#ff6fb5'}`,
          }}
        />
        <div
          className="absolute top-[28%] left-[82%] w-3 h-3 rounded-full animate-sparkle transition-colors duration-700"
          style={{
            animationDelay: '1s',
            backgroundColor: activeSectionIndex === 1 ? '#00bfff' : activeSectionIndex === 2 ? '#ffae00' : activeSectionIndex === 3 ? '#e0f7fa' : '#cf82d8',
            boxShadow: `0 0 16px ${activeSectionIndex === 1 ? '#00bfff' : activeSectionIndex === 2 ? '#ffae00' : activeSectionIndex === 3 ? '#e0f7fa' : '#cf82d8'}`,
          }}
        />
        <div
          className="absolute top-[48%] left-[28%] w-2 h-2 rounded-full animate-sparkle transition-colors duration-700"
          style={{
            animationDelay: '2.5s',
            backgroundColor: activeSectionIndex === 2 ? '#ffee55' : activeSectionIndex === 1 ? '#00e5ff' : '#ff9fdd',
            boxShadow: `0 0 12px ${activeSectionIndex === 2 ? '#ffee55' : activeSectionIndex === 1 ? '#00e5ff' : '#ff9fdd'}`,
          }}
        />
        <div
          className="absolute top-[68%] left-[75%] w-3 h-3 rounded-full animate-sparkle transition-colors duration-700"
          style={{
            animationDelay: '1.8s',
            backgroundColor: activeSectionIndex === 3 ? '#ffffff' : activeSectionIndex === 2 ? '#ffd700' : activeSectionIndex === 1 ? '#00f0ff' : '#ff6fb5',
            boxShadow: `0 0 18px ${activeSectionIndex === 3 ? '#ffffff' : activeSectionIndex === 2 ? '#ffd700' : activeSectionIndex === 1 ? '#00f0ff' : '#ff6fb5'}`,
          }}
        />
        <div
          className="absolute top-[88%] left-[18%] w-2.5 h-2.5 rounded-full animate-sparkle transition-colors duration-700"
          style={{
            animationDelay: '0.5s',
            backgroundColor: activeSectionIndex === 1 ? '#00bfff' : activeSectionIndex === 2 ? '#ffd700' : activeSectionIndex === 3 ? '#ffffff' : '#cf82d8',
            boxShadow: `0 0 14px ${activeSectionIndex === 1 ? '#00bfff' : activeSectionIndex === 2 ? '#ffd700' : activeSectionIndex === 3 ? '#ffffff' : '#cf82d8'}`,
          }}
        />
      </div>
    </div>
  );
};
