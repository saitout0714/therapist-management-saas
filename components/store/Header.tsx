'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { StoreConfig } from '../../types/store';
import { DIARY_FEATURE_ENABLED } from '../../lib/featureFlags';
import { SpecialGradeLogo } from './SpecialGradeLogo';

interface HeaderProps {
  store: StoreConfig;
}

export const Header: React.FC<HeaderProps> = ({ store }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const basePath = store.basePath ?? `/${store.slug}`;
  const reservePath = `/reserve/${store.slug}`;

  useEffect(() => {
    setImageError(false);
  }, [store.logoUrl]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 200);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // モバイル・ドロワーが閉じられたらスクロールロックを解除
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const navLinks = [
    { label: 'TOP', subLabel: 'トップページ', href: basePath || '/', code: '01' },
    { label: 'システム・料金', subLabel: 'コース・指名料金のご案内', href: `${basePath}/system`, code: '02' },
    { label: 'セラピスト一覧', subLabel: '在籍セラピストのご紹介', href: `${basePath}/therapists`, code: '03' },
    { label: '出勤スケジュール', subLabel: '本日・今週の出勤情報', href: `${basePath}/schedule`, code: '04' },
    ...(DIARY_FEATURE_ENABLED
      ? [{ label: 'セラピスト日記', subLabel: '写メ日記・キャストブログ', href: `${basePath}/diary`, code: '05' }]
      : []),
    { label: 'アクセス', subLabel: '店舗情報・ルームアクセス', href: `${basePath}/access`, code: '06' },
    { label: '求人情報', subLabel: 'セラピスト募集・採用', href: `${basePath}/recruit`, code: '07' },
  ];

  const primaryColor = store.themeColor?.primary || '#d1b464';
  const isCyberTheme = store.slug === 'onyankospa';
  const isLuxuryTheme = store.slug === 'specialgrade';

  return (
    <>
      {/* 1. 上部アナウンスティッカー (通常フローで最上部に配置し、HERO画像と被らないようにする) */}
      {store.noticeBanner && (
        <div
          style={{ backgroundColor: isCyberTheme || isLuxuryTheme ? undefined : primaryColor }}
          className={`text-xs py-1.5 px-4 text-center font-bold tracking-widest relative z-30 ${
            isCyberTheme
              ? 'bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8] neon-on-pink shadow-[0_0_18px_rgba(255,111,181,0.5)]'
              : isLuxuryTheme
              ? 'bg-[#efd8d5] text-[#3a3335] font-luxury-display italic font-medium text-[11px] tracking-[0.16em] py-1.5 border-b border-[#d8b3bd]/30 shadow-none'
              : 'text-white'
          }`}
        >
          {store.noticeBanner}
        </div>
      )}

      {/* 2. HERO上の初期透過ヘッダー (スクロールで自然に上に流れて消える) */}
      <header className={`z-30 ${
        isCyberTheme
          ? 'sticky top-0 backdrop-blur-xl border-b bg-[#150e20]/85 border-[#ff6fb5]/35 text-[#f4eefa] shadow-[0_6px_28px_rgba(255,111,181,0.22)]'
          : isLuxuryTheme
          ? `absolute ${store.noticeBanner ? 'top-8' : 'top-0'} inset-x-0 bg-transparent border-none text-white shadow-none pointer-events-auto`
          : 'sticky top-0 bg-white/95 border-b border-stone-200 text-stone-800 font-serif shadow-sm'
      }`}>
        {isLuxuryTheme ? (
          <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 pt-2 flex items-center justify-between">
            {/* 左側: Menu (misshelly風: 2本線 + Menuテキスト、常時表示) */}
            <div className="w-1/3 flex justify-start items-center">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center gap-2 text-xs font-luxury-display tracking-[0.22em] text-white hover:opacity-80 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] focus:outline-none transition-opacity uppercase cursor-pointer"
                aria-label="メニュー開閉"
              >
                <div className={`cyber-hamburger-icon flex flex-col justify-between w-[18px] h-[10px] ${isOpen ? 'is-open' : ''}`}>
                  <span className="!bg-white" />
                  <span className="!bg-white" />
                </div>
                <span>Menu</span>
              </button>
            </div>

            {/* 中央: misshelly風 センター配置 SpecialGradeLogo */}
            <div className="w-1/3 flex justify-center items-center">
              <Link href={basePath || '/'} className="flex items-center justify-center mt-6 drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
                <SpecialGradeLogo
                  variant="misshelly"
                  size="md"
                  markSize="lg"
                  theme="light"
                />
              </Link>
            </div>

            {/* 右側: Reserve (misshelly風: 白文字アンダーライン、左のMenuと完璧にサイズ・フォント・高さを統一) */}
            <div className="w-1/3 flex justify-end items-center">
              <Link
                href={reservePath}
                className="text-xs font-luxury-display uppercase text-white hover:opacity-80 border-b border-white/60 pb-0.5 tracking-[0.22em] drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] transition-opacity"
              >
                Reserve
              </Link>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            {/* 非ラグジュアリー 通常ロゴ */}
            <Link href={basePath || '/'} className="flex items-center gap-3 group">
              {store.logoUrl && !imageError && !store.logoUrl.includes('mainvisual') ? (
                <div className="relative h-12 w-[200px]">
                  <Image
                    src={store.logoUrl}
                    alt={store.name}
                    fill
                    sizes="200px"
                    priority
                    className="object-contain object-left transition-transform group-hover:scale-102 rounded-md shadow-sm"
                    onError={() => setImageError(true)}
                  />
                </div>
              ) : (
                <div className="flex flex-col">
                  {isCyberTheme && (
                    <span className="neon-script text-lg leading-none opacity-90" aria-hidden="true">
                      Onyanko Spa
                    </span>
                  )}
                  <span className={`text-xl sm:text-2xl font-bold tracking-widest transition-all ${
                    isCyberTheme ? 'neon-text-pink font-cyber-display' : 'text-stone-900 group-hover:text-opacity-80'
                  }`}>
                    {store.name}
                  </span>
                </div>
              )}
            </Link>

            {/* デスクトップナビゲーション */}
            <nav className="hidden lg:flex items-center gap-1 xl:gap-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 py-2 text-xs tracking-[0.15em] transition-all duration-400 ${
                    isCyberTheme
                      ? 'font-semibold text-[#ded1ee] hover:text-[#ffa8d8] after:absolute after:left-3 after:right-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-gradient-to-r after:from-[#ff6fb5] after:to-[#cf82d8] after:shadow-[0_0_10px_rgba(255,111,181,0.7)] after:opacity-0 after:transition-opacity after:duration-300 hover:after:opacity-100'
                      : 'font-semibold text-stone-700 hover:opacity-80'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* SNSリンク */}
              {(store.xUrl || store.lineUrl) && (
                <div className="flex items-center gap-1.5 ml-2">
                  {store.xUrl && (
                    <a
                      href={store.xUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="X (Twitter)"
                      className={`w-8 h-8 flex items-center justify-center rounded-full border transition-all duration-400 ${
                        isCyberTheme
                          ? 'border-[#ff6fb5]/40 text-[#ded1ee] hover:border-[#ff6fb5] hover:text-white hover:bg-[#ff6fb5]/20'
                          : 'border-stone-300 text-stone-600 hover:border-stone-500 hover:bg-stone-50'
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    </a>
                  )}
                  {store.lineUrl && (
                    <a
                      href={store.lineUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="公式LINE"
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-[#06C755] transition-transform hover:scale-105"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#fff">
                        <path d="M12 2C6.48 2 2 5.94 2 10.7c0 4.27 3.53 7.85 8.3 8.53.32.07.76.22.87.5.1.26.07.66.03.92l-.14.87c-.04.26-.2 1.01.88.55 1.08-.46 5.8-3.42 7.92-5.85C21.5 14.02 22 12.42 22 10.7 22 5.94 17.52 2 12 2z"/>
                      </svg>
                    </a>
                  )}
                </div>
              )}

              <Link
                href={reservePath}
                style={{ backgroundColor: isCyberTheme ? undefined : primaryColor }}
                className={`ml-3 px-6 py-2.5 text-white text-xs tracking-[0.15em] transition-all ${
                  isCyberTheme
                    ? 'font-bold rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8]'
                    : 'font-bold rounded-sm shadow-md hover:brightness-110'
                }`}
              >
                {isCyberTheme ? 'WEB予約 🐾' : 'WEB予約'}
              </Link>
            </nav>

            {/* モバイルメニューボタン */}
            <div className="flex lg:hidden items-center gap-2">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2.5 rounded-xl transition-all duration-300 focus:outline-none ${
                  isCyberTheme
                    ? isOpen
                      ? 'bg-[#ff6fb5]/20 text-[#ff6fb5] border border-[#ff6fb5]/60 shadow-[0_0_18px_rgba(255,111,181,0.5)]'
                      : 'bg-stone-900/60 text-[#c4b2dc] hover:text-[#ffa8d8] border border-[#ff6fb5]/30'
                    : 'text-stone-700 hover:text-stone-900'
                }`}
                aria-label="メニュー開閉"
              >
                <div className={`cyber-hamburger-icon flex flex-col justify-between w-[22px] h-[16px] ${isOpen ? 'is-open' : ''}`}>
                  <span />
                  <span />
                  <span />
                </div>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 3. スクロールして初期ヘッダーが消えた際に出現する固定ヘッダー (Sticky Floating Header) */}
      {isLuxuryTheme && (
        <aside
          className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ease-out transform ${
            isScrolled
              ? 'translate-y-0 opacity-100 bg-[#efd8d5]/95 backdrop-blur-md border-b border-[#d8b3bd]/40 shadow-sm'
              : '-translate-y-full opacity-0 pointer-events-none'
          }`}
          aria-hidden={!isScrolled}
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
            {/* 左側: ハンバーガーメニュー */}
            <div className="w-1/3 flex justify-start items-center">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center gap-2 text-xs font-luxury-display tracking-[0.22em] text-[#2b2827] hover:text-[#c5a059] focus:outline-none transition-colors uppercase cursor-pointer"
                aria-label="メニュー開閉"
              >
                <div className={`cyber-hamburger-icon flex flex-col justify-between w-[18px] h-[10px] ${isOpen ? 'is-open' : ''}`}>
                  <span className="!bg-[#2b2827]" />
                  <span className="!bg-[#2b2827]" />
                </div>
                <span className="font-semibold">Menu</span>
              </button>
            </div>

            {/* 中央: SpecialGradeLogo (ダークテーマ) */}
            <div className="w-1/3 flex justify-center items-center">
              <Link href={basePath || '/'} className="flex items-center justify-center">
                <SpecialGradeLogo
                  variant="misshelly"
                  size="sm"
                  theme="dark"
                />
              </Link>
            </div>

            {/* 右側: Reserve ボタン */}
            <div className="w-1/3 flex justify-end items-center">
              <Link
                href={reservePath}
                className="luxury-gold-btn px-4 sm:px-5 py-1.5 rounded-full text-[11px] font-medium tracking-[0.16em] uppercase shadow-sm transition-transform active:scale-95 text-white"
              >
                Reserve
              </Link>
            </div>
          </div>
        </aside>
      )}

      {/* バックドロップオーバーレイ (常に描画し、opacity と pointer-events でなめらかにフェードイン/アウト) */}
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-[99] ${isLuxuryTheme ? '' : 'lg:hidden'} transition-opacity duration-300 ease-in-out ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* ドロワーメニュー (透明感のあるシースルーガラス) */}
      <div
        className={`fixed inset-y-0 right-0 z-[100] w-full max-w-xs sm:max-w-sm ${isLuxuryTheme ? 'lg:max-w-md' : 'lg:hidden'} flex flex-col justify-between p-6 overflow-y-auto transition-transform duration-300 ease-out transform ${
          isOpen
            ? `translate-x-0 ${isCyberTheme ? 'shadow-[-20px_0_60px_rgba(255,111,181,0.5)]' : 'shadow-[-12px_0_40px_rgba(226,179,177,0.18)]'}`
            : 'translate-x-full shadow-none'
        } ${
          isCyberTheme
            ? 'bg-[#0d061e]/45 backdrop-blur-2xl border-l-2 border-[#ff6fb5]/70 text-[#f4eefa]'
            : isLuxuryTheme
            ? 'luxury-drawer-bg backdrop-blur-2xl border-l border-[#e2b3b1]/35 text-[#241f1e] luxury-body'
            : 'bg-white/95 backdrop-blur-xl border-l border-[#d1b464]/30 text-stone-800 font-serif'
        }`}
      >
        {/* ドロワーヘッダー */}
        <div>
          {isLuxuryTheme && (
            <div className="flex flex-col items-center gap-3 pt-1 pb-5">
              <SpecialGradeLogo variant="mark-only" size="lg" theme="gold" />
              <div className="luxury-gold-rule w-14" />
            </div>
          )}
          <div className={`flex items-center pb-4 border-b mb-5 ${
            isLuxuryTheme ? 'justify-end border-[#e2b3b1]/35' : `justify-between ${isCyberTheme ? 'border-[#ff6fb5]/40' : 'border-stone-200'}`
          }`}>
            {isCyberTheme ? (
              <>
                <div className="flex items-center gap-2 text-[11px] font-mono text-[#ffa8d8] tracking-widest uppercase drop-shadow-[0_0_6px_#ff6fb5]">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#34d399]" />
                  SYSTEM NAV : ONLINE
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-[#ff6fb5] hover:text-white text-lg font-extrabold focus:outline-none transition-transform hover:scale-110 drop-shadow-[0_0_10px_#ff6fb5]"
                  aria-label="閉じる"
                >
                  ✕
                </button>
              </>
            ) : isLuxuryTheme ? (
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-4xl leading-none font-luxury-display font-light text-[#8a7e7c] hover:text-[#c5a059] transition-colors duration-300"
                aria-label="閉じる"
              >
                ×
              </button>
            ) : (
              <>
                <span className="text-xs tracking-[0.25em] font-bold text-stone-500">MENU</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-lg font-bold text-stone-600 hover:text-stone-900 transition-colors duration-300"
                  aria-label="閉じる"
                >
                  ×
                </button>
              </>
            )}
          </div>

          {/* ナビゲーションリンク一覧 */}
          {isLuxuryTheme ? (
            <div className="flex flex-col divide-y divide-[#e2b3b1]/25">
              {navLinks.map((link, idx) => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{ animationDelay: isOpen ? `${idx * 40}ms` : '0ms' }}
                  onClick={() => setIsOpen(false)}
                  className={`group relative flex items-center justify-center py-4 font-luxury-display italic font-semibold text-lg tracking-[0.1em] text-[#241f1e] transition-colors duration-400 hover:text-[#c5a059] ${isOpen ? 'cyber-link-anim' : ''}`}
                >
                  <span>{link.label}</span>
                  <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 w-0 h-px bg-[#c5a059] transition-all duration-500 group-hover:w-8" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {navLinks.map((link, idx) => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{ animationDelay: isOpen ? `${idx * 40}ms` : '0ms' }}
                  onClick={() => setIsOpen(false)}
                  className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all duration-400 ${
                    isCyberTheme
                      ? 'cyber-menu-link border-[#ff6fb5]/30 bg-[#ff6fb5]/10 backdrop-blur-md text-white hover:bg-[#ff6fb5]/25 hover:border-[#ff6fb5] hover:shadow-[0_0_20px_rgba(255,111,181,0.5)]'
                      : 'border-stone-100 hover:bg-[#faf7f0] hover:text-[#a39573]'
                  } ${isOpen ? 'cyber-link-anim' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    {isCyberTheme && (
                      <span className="text-xs font-mono font-bold text-[#ff6fb5] tracking-widest opacity-80 group-hover:opacity-100">
                        {link.code}
                      </span>
                    )}
                    <div>
                      <div className="text-sm font-bold tracking-widest group-hover:translate-x-1 transition-transform">
                        {link.label}
                      </div>
                      {isCyberTheme && (
                        <div className="text-[10px] text-[#ded1ee]/60 font-sans tracking-wide">
                          {link.subLabel}
                        </div>
                      )}
                    </div>
                  </div>

                  {isCyberTheme && (
                    <span className="text-xs text-[#ff6fb5]/50 group-hover:text-[#ff6fb5] group-hover:translate-x-1 transition-all">
                      ➔
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ドロワーフッターアクション */}
        <div className={`pt-5 mt-6 space-y-3 border-t ${
          isCyberTheme ? 'border-[#ff6fb5]/30' : isLuxuryTheme ? 'border-[#e2b3b1]/30' : 'border-stone-200'
        }`}>
          {(store.xUrl || store.lineUrl) && (
            <div className="flex items-center justify-center gap-3 pb-1">
              {store.xUrl && (
                <a
                  href={store.xUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X (Twitter)"
                  className={`w-11 h-11 flex items-center justify-center rounded-full border transition-all duration-400 ${
                    isCyberTheme
                      ? 'border-[#ff6fb5]/40 text-[#ded1ee] hover:border-[#ff6fb5] hover:text-white hover:bg-[#ff6fb5]/20'
                      : isLuxuryTheme
                      ? 'border-[#e2b3b1]/45 text-[#4a3e3d] hover:border-[#c5a059] hover:text-[#c5a059] hover:bg-white hover:shadow-[0_0_15px_rgba(226,179,177,0.3)]'
                      : 'border-stone-300 text-stone-600 hover:border-stone-500 hover:bg-stone-50'
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              )}
              {store.lineUrl && (
                <a
                  href={store.lineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="公式LINE"
                  className="w-11 h-11 flex items-center justify-center rounded-full bg-[#06C755] transition-transform hover:scale-105"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#fff">
                    <path d="M12 2C6.48 2 2 5.94 2 10.7c0 4.27 3.53 7.85 8.3 8.53.32.07.76.22.87.5.1.26.07.66.03.92l-.14.87c-.04.26-.2 1.01.88.55 1.08-.46 5.8-3.42 7.92-5.85C21.5 14.02 22 12.42 22 10.7 22 5.94 17.52 2 12 2z"/>
                  </svg>
                </a>
              )}
            </div>
          )}
          <Link
            href={reservePath}
            onClick={() => setIsOpen(false)}
            className={`block w-full py-3 text-center text-white text-sm tracking-widest active:scale-95 transition-all duration-300 ${
              isCyberTheme
                ? 'font-extrabold rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8] shadow-[0_0_20px_rgba(255,111,181,0.6)]'
                : isLuxuryTheme
                ? 'font-medium tracking-[0.15em] rounded-full luxury-gold-btn shadow-md'
                : 'font-extrabold rounded-xl shadow-md bg-gradient-to-r from-[#d1b464] to-[#a39573]'
            }`}
          >
            {isLuxuryTheme ? 'ONLINE RESERVATION' : '🐾 24H WEB予約はこちら 🐾'}
          </Link>

          {isCyberTheme && (
            <p className="text-[10px] text-center font-mono text-[#ded1ee]/50 tracking-wider">
              © ONYANKO SPA CYBER SYSTEM
            </p>
          )}
        </div>
      </div>
    </>
  );
};
