'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { StoreConfig } from '../../types/store';

interface HeaderProps {
  store: StoreConfig;
}

export const Header: React.FC<HeaderProps> = ({ store }) => {
  const [isOpen, setIsOpen] = useState(false);
  const basePath = `/${store.slug}`;

  const navLinks = [
    { label: 'TOP', href: basePath },
    { label: 'システム・料金', href: `${basePath}/system` },
    { label: 'セラピスト一覧', href: `${basePath}/therapists` },
    { label: '出勤スケジュール', href: `${basePath}/schedule` },
    { label: 'セラピスト日記', href: `${basePath}/diary` },
    { label: 'アクセス', href: `${basePath}/access` },
    { label: '求人情報', href: `${basePath}/recruit` },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#d1b464]/30 text-stone-800 transition-all font-serif">
      {store.noticeBanner && (
        <div className="bg-gradient-to-r from-[#d1b464] via-[#e5cf87] to-[#d1b464] text-stone-900 text-xs py-1.5 px-4 text-center font-semibold tracking-widest shadow-sm">
          {store.noticeBanner}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* 店舗ロゴ / タイトル */}
        <Link href={basePath} className="flex items-center gap-3 group">
          <div className="text-center sm:text-left">
            <h1 className="font-extrabold text-xl sm:text-2xl tracking-wider text-stone-800 group-hover:text-[#a39573] transition-colors">
              Special Grade
            </h1>
            <p className="text-[11px] text-stone-500 tracking-widest hidden sm:block">
              {store.catchphrase}
            </p>
          </div>
        </Link>

        {/* デスクトップナビゲーション */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-2 text-xs font-semibold tracking-widest text-stone-700 hover:text-[#a39573] transition-all"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={`${basePath}/reserve`}
            className="ml-3 px-5 py-2.5 bg-gradient-to-r from-[#d1b464] to-[#a39573] hover:from-[#c2a353] hover:to-[#928462] text-white text-xs font-bold tracking-widest rounded-sm shadow-md transition-all border border-[#d1b464]"
          >
            WEB予約
          </Link>
        </nav>

        {/* モバイルメニューボタン */}
        <div className="flex lg:hidden items-center gap-2">
          <Link
            href={`${basePath}/reserve`}
            className="px-3 py-1.5 bg-[#d1b464] text-white text-xs font-bold rounded-sm shadow-sm"
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
