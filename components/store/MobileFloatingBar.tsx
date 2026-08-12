'use client';

import React from 'react';
import Link from 'next/link';
import { StoreConfig } from '../../types/store';

interface MobileFloatingBarProps {
  store: StoreConfig;
}

export const MobileFloatingBar: React.FC<MobileFloatingBarProps> = ({ store }) => {
  const basePath = `/${store.slug}`;
  const primaryColor = store.themeColor?.primary || '#d1b464';
  const isCyber = store.slug === 'onyankospa' || primaryColor === '#ff6fb5';

  return (
    <div
      style={{ borderColor: isCyber ? 'rgba(255,111,181,0.4)' : `${primaryColor}60` }}
      className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 p-2.5 transition-all ${
        isCyber
          ? 'bg-[#0d0914]/90 backdrop-blur-xl border-t border-[#ff6fb5]/45 shadow-[0_-6px_28px_rgba(255,111,181,0.28)]'
          : 'bg-stone-950/95 backdrop-blur-md border-t font-serif shadow-2xl'
      }`}
    >
      <div className="max-w-md mx-auto grid grid-cols-2 gap-2">
        <a
          href={`tel:${store.phoneNumber.replace(/[^0-9]/g, '')}`}
          style={{ color: isCyber ? '#ffa8d8' : primaryColor, borderColor: isCyber ? 'rgba(255,111,181,0.5)' : `${primaryColor}60` }}
          className={`flex items-center justify-center gap-1.5 py-3 px-3 border rounded-full font-bold text-xs shadow-md transition-all active:scale-95 ${
            isCyber ? 'bg-white/10 hover:bg-white/20 hover:shadow-[0_0_16px_rgba(255,111,181,0.45)]' : 'bg-stone-900 hover:bg-stone-800'
          }`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <span>お電話で予約</span>
        </a>

        <Link
          href={`${basePath}/reserve`}
          style={{ backgroundColor: isCyber ? undefined : primaryColor }}
          className={`flex items-center justify-center gap-1.5 py-3 px-3 text-white font-bold text-xs transition-all active:scale-95 ${
            isCyber
              ? 'rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8]'
              : 'rounded-xl shadow-lg hover:brightness-110'
          }`}
        >
          <svg className="w-4 h-4 shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>24時間 WEB予約</span>
        </Link>
      </div>
    </div>
  );
};
