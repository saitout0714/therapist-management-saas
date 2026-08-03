'use client';

import React, { useState, useEffect, use } from 'react';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { ThemeProvider } from '../../../../components/store/ThemeProvider';
import { fetchStoreConfig } from '../../../../lib/storeApi';
import { StoreConfig } from '../../../../types/store';
import { MOCK_STORE } from '../../../../mock/specialgrade';

export default function AccessPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const [store, setStore] = useState<StoreConfig>(MOCK_STORE);

  useEffect(() => {
    async function loadData() {
      const storeConfig = await fetchStoreConfig(shopSlug);
      setStore(storeConfig);
    }
    loadData();
  }, [shopSlug]);

  return (
    <ThemeProvider store={store}>
      <div className="min-h-screen bg-[#faf9f5] text-stone-800 flex flex-col font-serif">
      <Header store={store} />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-stone-800 tracking-widest">Access</h1>
          <span className="inline-block text-xs text-[#a39573] border-t border-stone-800 px-4 pt-1 mt-1 tracking-widest">
            アクセス・店舗案内
          </span>
        </div>

        <div className="bg-white rounded-sm border border-[#d1b464]/30 p-6 sm:p-8 shadow-sm space-y-6">
          {/* Google Maps カード / リンク案内 */}
          <div className="aspect-[16/9] w-full bg-[#faf7f0] rounded-sm overflow-hidden border border-[#d1b464]/30 flex flex-col items-center justify-center text-stone-500 text-xs p-6 relative group">
            <div className="text-center space-y-3">
              <div className="text-[#a39573] font-bold text-lg tracking-wider flex items-center justify-center gap-2">
                <span>📍</span> Google Maps アクセス案内
              </div>
              <p className="text-stone-700 text-xs font-semibold">{store.address}</p>
              {store.googleMapUrl ? (
                <a
                  href={store.googleMapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-6 py-2.5 bg-stone-900 text-white font-bold text-xs rounded-sm hover:bg-[#a39573] transition-colors shadow-sm tracking-widest"
                >
                  Google Maps で場所を開く ↗
                </a>
              ) : (
                <p className="text-stone-400 text-[11px]">最寄り駅からの案内は下記をご覧ください</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 text-xs">
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-[#a39573] border-b border-[#d1b464]/30 pb-1 tracking-wider">
                店舗情報
              </h3>
              <p><span className="text-stone-400 font-medium">店舗名：</span><span className="font-semibold text-stone-800">{store.name}</span></p>
              <p><span className="text-stone-400 font-medium">住所：</span><span className="font-semibold text-stone-800">{store.address}</span></p>
              <p><span className="text-stone-400 font-medium">営業時間：</span><span className="font-semibold text-stone-800">{store.businessHours}</span></p>
              <p><span className="text-stone-400 font-medium">電話番号：</span><span className="font-semibold text-stone-800">{store.phoneNumber}</span></p>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-sm text-[#a39573] border-b border-[#d1b464]/30 pb-1 tracking-wider">
                アクセス案内
              </h3>
              <p className="text-stone-700 leading-relaxed whitespace-pre-wrap">{store.accessInfo}</p>
              <p className="text-stone-500 text-[11px] leading-relaxed pt-2 border-t border-stone-100">
                ※道順にお迷いの際や場所がご不明な場合は、お気軽に店舗お電話（<span className="font-bold text-stone-700">{store.phoneNumber}</span>）までお問い合わせください。スタッフがご案内いたします。
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer store={store} />
    </div>
    </ThemeProvider>
  );
}

