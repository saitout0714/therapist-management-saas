'use client';

import React from 'react';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { MOCK_STORE } from '../../../../mock/specialgrade';

export default function AccessPage() {
  return (
    <div className="min-h-screen bg-[#faf9f5] text-stone-800 flex flex-col font-serif">
      <Header store={MOCK_STORE} />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-stone-800 tracking-widest">Access</h1>
          <span className="inline-block text-xs text-[#a39573] border-t border-stone-800 px-4 pt-1 mt-1 tracking-widest">
            アクセス・店舗案内
          </span>
        </div>

        <div className="bg-white rounded-sm border border-[#d1b464]/30 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="aspect-[16/9] w-full bg-[#faf7f0] rounded-sm overflow-hidden border border-[#d1b464]/30 flex items-center justify-center text-stone-500 text-xs">
            <div className="text-center p-6 space-y-2">
              <div className="text-[#a39573] font-bold text-base">📍 Google Maps</div>
              <p className="text-stone-600 text-xs">{MOCK_STORE.address}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 text-xs">
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-[#a39573] border-b border-[#d1b464]/30 pb-1 tracking-wider">
                店舗情報
              </h3>
              <p><span className="text-stone-400">店舗名：</span>{MOCK_STORE.name}</p>
              <p><span className="text-stone-400">住所：</span>{MOCK_STORE.address}</p>
              <p><span className="text-stone-400">営業時間：</span>{MOCK_STORE.businessHours}</p>
              <p><span className="text-stone-400">電話番号：</span>{MOCK_STORE.phoneNumber}</p>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-sm text-[#a39573] border-b border-[#d1b464]/30 pb-1 tracking-wider">
                アクセス案内
              </h3>
              <p className="text-stone-700 leading-relaxed">{MOCK_STORE.accessInfo}</p>
              <p className="text-stone-500 text-[11px] leading-relaxed pt-2">
                ※場所が分からない場合やお迷いの際は、お気軽に店舗お電話までご連絡ください。スタッフが丁寧にご案内いたします。
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer store={MOCK_STORE} />
    </div>
  );
}
