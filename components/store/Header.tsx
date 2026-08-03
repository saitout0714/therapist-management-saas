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

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-sm font-serif">
      {store.noticeBanner && (
        <div style={{ backgroundColor: primaryColor }} className="text-white text-xs py-1.5 px-4 text-center font-semibold tracking-widest shadow-sm">
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
                className="max-h-full w-auto object-contain transition-transform group-hover:scale-102"
                onError={() => setImageError(true)}
              />
            </div>
          ) : (
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-bold tracking-widest text-stone-900 group-hover:text-opacity-80 transition-colors">
                {store.name}
              </span>
              <span className="text-[10px] tracking-widest text-stone-600 font-sans">
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
              className="px-3 py-2 text-xs font-semibold tracking-widest text-stone-700 hover:opacity-80 transition-all"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={`${basePath}/reserve`}
            style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
            className="ml-3 px-5 py-2.5 text-white text-xs font-bold tracking-widest rounded-sm shadow-md hover:brightness-110 transition-all"
          >
            WEB予約
          </Link>
        </nav>

        {/* モバイルメニューボタン */}
        <div className="flex lg:hidden items-center gap-2">
          <Link
            href={`${basePath}/reserve`}
            style={{ backgroundColor: primaryColor }}
            className="px-3 py-1.5 text-white text-xs font-bold rounded-sm shadow-sm"
          >
            予約
          </Link>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-stone-700 hover:text-stone-900 focus:outline-none"
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
        <div className="lg:hidden bg-white border-b border-[#d1b464]/30 px-4 pt-2 pb-6 space-y-2 animate-fadeIn font-serif">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-[#faf7f0] hover:text-[#a39573] transition-colors border-b border-stone-100"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2">
            <Link
              href={`${basePath}/reserve`}
              onClick={() => setIsOpen(false)}
              className="block w-full py-3 text-center bg-gradient-to-r from-[#d1b464] to-[#a39573] text-white font-bold text-sm tracking-widest shadow-md"
            >
              WEB予約はこちら
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
