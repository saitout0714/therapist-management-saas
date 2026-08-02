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
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 text-slate-100 transition-all">
      {store.noticeBanner && (
        <div className="bg-gradient-to-r from-rose-600 to-pink-600 text-white text-xs py-1 px-4 text-center font-medium tracking-wide">
          {store.noticeBanner}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* 店舗ロゴ / タイトル */}
        <Link href={basePath} className="flex items-center gap-3 group">
          {store.logoUrl ? (
            <img
              src={store.logoUrl}
              alt={store.name}
              className="h-10 w-10 rounded-full object-cover border-2 border-rose-500/50 group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center font-bold text-white shadow-lg shadow-rose-500/30">
              SG
            </div>
          )}
          <div>
            <h1 className="font-extrabold text-lg tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-pink-300 to-amber-200">
              {store.name}
            </h1>
            <p className="text-[10px] text-slate-400 hidden sm:block">{store.catchphrase}</p>
          </div>
        </Link>

        {/* デスクトップナビゲーション */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-2 text-xs font-semibold tracking-wider text-slate-300 hover:text-rose-400 hover:bg-slate-900/80 rounded-lg transition-all"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={`${basePath}/reserve`}
            className="ml-2 px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 text-white text-xs font-bold tracking-wider rounded-full shadow-lg shadow-rose-600/30 hover:shadow-rose-600/50 hover:scale-105 transition-all"
          >
            WEB予約
          </Link>
        </nav>

        {/* モバイルメニューボタン */}
        <div className="flex lg:hidden items-center gap-2">
          <Link
            href={`${basePath}/reserve`}
            className="px-3 py-1.5 bg-gradient-to-r from-rose-600 to-pink-600 text-white text-xs font-bold rounded-full shadow-md shadow-rose-600/20"
          >
            予約
          </Link>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-slate-300 hover:text-white rounded-lg focus:outline-none"
            aria-label="メニュー開閉"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* モバイルドロワーナビゲーション */}
      {isOpen && (
        <div className="lg:hidden bg-slate-950/95 border-b border-slate-800 px-4 pt-2 pb-6 space-y-2 animate-fadeIn">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-900 hover:text-rose-400 rounded-xl transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2">
            <Link
              href={`${basePath}/reserve`}
              onClick={() => setIsOpen(false)}
              className="block w-full py-3 text-center bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-rose-600/30"
            >
              WEB予約はこちら
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
