'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { StoreConfig } from '../../types/store';

interface HeaderProps {
  store: StoreConfig;
}

export const Header: React.FC<HeaderProps> = ({ store }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const basePath = `/${store.slug}`;

  useEffect(() => {
    setImageError(false);
  }, [store.logoUrl]);

  const navLinks = [
    { label: 'TOP', href: basePath },
    { label: 'システム・料金', href: `${basePath}/system` },
    { label: 'セラピスト一覧', href: `${basePath}/therapists` },
    { label: '出勤スケジュール', href: `${basePath}/schedule` },
    { label: 'セラピスト日記', href: `${basePath}/diary` },
    { label: 'アクセス', href: `${basePath}/access` },
    { label: '求人情報', href: `${basePath}/recruit` },
  ];

  const primaryColor = store.themeColor?.primary || '#d1b464';
  const isCyberTheme = store.slug === 'onyankospa';

  return (
    <header className={`sticky top-0 z-40 backdrop-blur-md shadow-sm border-b ${
      isCyberTheme
        ? 'bg-[#050014]/90 border-[#ff007f]/40 text-stone-100 font-sans'
        : 'bg-white/95 border-stone-200 text-stone-800 font-serif'
    }`}>
      {store.noticeBanner && (
        <div style={{ backgroundColor: primaryColor }} className="text-white text-xs py-1.5 px-4 text-center font-semibold tracking-widest shadow-md">
          {store.noticeBanner}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* ロゴ / 店舗名 */}
        <Link href={basePath} className="flex items-center gap-3 group">
          {store.logoUrl && !imageError ? (
            <div className="h-12 max-w-[200px] flex items-center">
              <img
                src={store.logoUrl}
                alt={store.name}
                className="max-h-full w-auto object-contain transition-transform group-hover:scale-102 rounded-md shadow-sm"
                onError={() => setImageError(true)}
              />
            </div>
          ) : (
            <div className="flex flex-col">
              <span className={`text-xl sm:text-2xl font-bold tracking-widest group-hover:text-opacity-80 transition-colors ${
                isCyberTheme ? 'neon-text-pink' : 'text-stone-900'
              }`}>
                {store.name}
              </span>
              <span className={`text-[10px] tracking-widest font-sans ${isCyberTheme ? 'text-pink-300' : 'text-stone-600'}`}>
                {store.catchphrase}
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
              className={`px-3 py-2 text-xs font-semibold tracking-widest transition-all ${
                isCyberTheme
                  ? 'text-pink-100 hover:text-[#ff007f] hover:drop-shadow-[0_0_8px_#ff007f]'
                  : 'text-stone-700 hover:opacity-80'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={`${basePath}/reserve`}
            style={{ backgroundColor: primaryColor }}
            className={`ml-3 px-5 py-2.5 text-white text-xs font-bold tracking-widest shadow-md hover:brightness-110 transition-all ${
              isCyberTheme ? 'rounded-full shadow-[0_0_15px_rgba(255,0,127,0.6)]' : 'rounded-sm'
            }`}
          >
            WEB予約
          </Link>
        </nav>

        {/* モバイルメニューボタン */}
        <div className="flex lg:hidden items-center gap-2">
          <Link
            href={`${basePath}/reserve`}
            style={{ backgroundColor: primaryColor }}
            className={`px-3 py-1.5 text-white text-xs font-bold shadow-sm ${isCyberTheme ? 'rounded-full' : 'rounded-sm'}`}
          >
            予約
          </Link>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`p-2 focus:outline-none ${isCyberTheme ? 'text-pink-200 hover:text-white' : 'text-stone-700 hover:text-stone-900'}`}
            aria-label="メニュー開閉"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* モバイルドロワーナビゲーション */}
      {isOpen && (
        <div className={`lg:hidden border-b px-4 pt-2 pb-6 space-y-2 animate-fadeIn ${
          isCyberTheme
            ? 'bg-[#1a0933] border-[#ff007f]/30 font-sans'
            : 'bg-white border-[#d1b464]/30 font-serif'
        }`}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className={`block px-4 py-2.5 text-sm font-medium border-b ${
                isCyberTheme
                  ? 'text-pink-100 hover:bg-[#050014] hover:text-[#ff007f] border-[#ff007f]/20'
                  : 'text-stone-700 hover:bg-[#faf7f0] hover:text-[#a39573] border-stone-100'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2">
            <Link
              href={`${basePath}/reserve`}
              onClick={() => setIsOpen(false)}
              className={`block w-full py-3 text-center text-white font-bold text-sm tracking-widest shadow-md ${
                isCyberTheme
                  ? 'bg-[#ff007f] hover:bg-[#ff2a8d] rounded-full shadow-[0_0_15px_rgba(255,0,127,0.6)]'
                  : 'bg-gradient-to-r from-[#d1b464] to-[#a39573]'
              }`}
            >
              WEB予約はこちら
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
