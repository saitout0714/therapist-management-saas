'use client';

import React from 'react';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { MOCK_STORE } from '../../../../mock/specialgrade';

export default function AccessPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header store={MOCK_STORE} />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-300">
            アクセス・店舗案内
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            店舗へのアクセス方法および店舗情報
          </p>
        </div>

        <div className="bg-slate-900/80 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="aspect-[16/9] w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center text-slate-500 text-xs">
            {/* Google Map 埋め込みエリア（モック） */}
            <div className="text-center p-6 space-y-2">
              <div className="text-rose-400 font-bold text-base">📍 Google Maps</div>
              <p className="text-slate-400 text-xs">{MOCK_STORE.address}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 text-xs">
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-rose-300 border-l-2 border-rose-500 pl-2">
                店舗情報
              </h3>
              <p><span className="text-slate-500">店舗名：</span>{MOCK_STORE.name}</p>
              <p><span className="text-slate-500">住所：</span>{MOCK_STORE.address}</p>
              <p><span className="text-slate-500">営業時間：</span>{MOCK_STORE.businessHours}</p>
              <p><span className="text-slate-500">電話番号：</span>{MOCK_STORE.phoneNumber}</p>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-sm text-rose-300 border-l-2 border-rose-500 pl-2">
                アクセス案内
              </h3>
              <p className="text-slate-300 leading-relaxed">{MOCK_STORE.accessInfo}</p>
              <p className="text-slate-400 text-[11px] leading-relaxed pt-2">
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
