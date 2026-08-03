'use client';

import React from 'react';
import Link from 'next/link';
import { StoreConfig } from '../../types/store';

interface MobileFloatingBarProps {
  store: StoreConfig;
}

export const MobileFloatingBar: React.FC<MobileFloatingBarProps> = ({ store }) => {
  const basePath = `/${store.slug}`;

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-stone-900/95 backdrop-blur-md border-t border-[#d1b464]/40 p-2.5 shadow-2xl transition-all font-serif">
      <div className="max-w-md mx-auto grid grid-cols-2 gap-2">
        <a
          href={`tel:${store.phoneNumber.replace(/[^0-9]/g, '')}`}
          className="flex items-center justify-center gap-1.5 py-3 px-3 bg-stone-800 hover:bg-stone-700 text-[#d1b464] border border-[#d1b464]/50 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
        >
          <svg className="w-4 h-4 shrink-0 text-[#d1b464]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <span>お電話で予約</span>
        </a>

        <Link
          href={`${basePath}/reserve`}
          className="flex items-center justify-center gap-1.5 py-3 px-3 bg-gradient-to-r from-[#d1b464] to-[#a39573] hover:from-[#c2a353] hover:to-[#928462] text-stone-950 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 border border-[#d1b464]"
        >
          <svg className="w-4 h-4 shrink-0 text-stone-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>24時間 WEB予約</span>
        </Link>
      </div>
    </div>
  );
};
