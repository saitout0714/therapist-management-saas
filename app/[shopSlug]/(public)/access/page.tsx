'use client';

import React, { useState, useEffect, use } from 'react';
import { Header } from '../../../../components/store/Header';
import { PageHeading } from '../../../../components/store/SectionHeading';
import { Footer } from '../../../../components/store/Footer';
import { ThemeProvider } from '../../../../components/store/ThemeProvider';
import { fetchStoreConfig, fetchStoreRooms, RoomInfo } from '../../../../lib/storeApi';
import { StoreConfig } from '../../../../types/store';
import { BLANK_STORE } from '../../../../mock/specialgrade';
import { BLANK_ONYANKO_STORE } from '../../../../mock/onyankospa';

import { CyberParallaxBackground } from '../../../../components/store/CyberParallaxBackground';

export default function AccessPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const isOnyanko = shopSlug === 'onyankospa';
  const [store, setStore] = useState<StoreConfig>(isOnyanko ? BLANK_ONYANKO_STORE : BLANK_STORE);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);

  useEffect(() => {
    async function loadData() {
      const storeConfig = await fetchStoreConfig(shopSlug);
      setStore(storeConfig);
      const rList = await fetchStoreRooms(storeConfig.id);
      setRooms(rList);
    }
    loadData();
  }, [shopSlug]);

  const isCyberTheme = shopSlug === 'onyankospa';

  return (
    <ThemeProvider store={store}>
      <div className={`min-h-screen flex flex-col relative ${
        isCyberTheme ? 'cyber-bg text-[#f4eefa]' : 'bg-[#faf9f5] text-stone-800 font-serif'
      }`}>
        {isCyberTheme && <CyberParallaxBackground variant="medium" pageType="access" />}
        <Header store={store} />

        <main className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full relative z-10">
        <PageHeading title="Access" subtitle="アクセス・店舗案内" isCyber={isCyberTheme} className="mb-8" />

        <div className={`p-6 sm:p-8 space-y-6 ${
          isCyberTheme
            ? 'cyber-card reveal rounded-xl border-[#ff6fb5]/40'
            : 'bg-white rounded-sm border border-[#d1b464]/30 shadow-sm'
        }`}>

          {/* 複数ルームが登録されている場合の表示 */}
          {rooms.length > 0 ? (
            <div className="space-y-6">
              <h2 className={`font-bold text-sm border-b pb-2 tracking-wider flex items-center gap-2 ${
                isCyberTheme ? 'neon-text-pink border-[#ff6fb5]/40' : 'text-[#a39573] border-[#d1b464]/40'
              }`}>
                <span>🏠</span> ルーム案内（全{rooms.length}拠点）
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className={`p-5 rounded-xl border space-y-3 ${
                      isCyberTheme
                        ? 'bg-white/10 border-[#ff6fb5]/30'
                        : 'bg-[#faf7f0] border-[#d1b464]/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className={`font-bold text-sm ${isCyberTheme ? 'neon-text-pink' : 'text-stone-800'}`}>
                        🏠 {room.name}
                      </h3>
                    </div>

                    {room.address && (
                      <p className={`text-xs ${isCyberTheme ? 'text-[#f4eefa]' : 'text-stone-700'}`}>
                        <span className={isCyberTheme ? 'text-[#ffa8d8]' : 'text-stone-400'}>住所：</span>
                        {room.address}
                      </p>
                    )}

                    {room.address && (
                      <div className={`aspect-[4/3] w-full rounded-lg overflow-hidden border ${
                        isCyberTheme ? 'border-[#ff6fb5]/30' : 'border-[#d1b464]/20'
                      }`}>
                        <iframe
                          title={`${room.name}の地図`}
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(room.address)}&z=15&output=embed`}
                          className="w-full h-full border-0"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      </div>
                    )}

                    {room.googleMapUrl && (
                      <div className="pt-2">
                        <a
                          href={room.googleMapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-block px-4 py-2 font-bold text-xs shadow-sm tracking-widest transition-colors ${
                            isCyberTheme
                              ? 'text-white rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8]'
                              : 'bg-stone-900 text-white rounded-sm hover:bg-[#a39573]'
                          }`}
                        >
                          Google Maps で場所を開く ↗
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* 単一店舗案内 */
            <div className={`aspect-[16/9] w-full rounded-xl border p-6 flex flex-col items-center justify-center text-xs relative group ${
              isCyberTheme
                ? 'bg-white/10 border-[#ff6fb5]/40 text-[#ded1ee]'
                : 'bg-[#faf7f0] border-[#d1b464]/30 text-stone-500'
            }`}>
              <div className="text-center space-y-3">
                <div className={`font-bold text-lg tracking-wider flex items-center justify-center gap-2 ${
                  isCyberTheme ? 'neon-text-pink' : 'text-[#a39573]'
                }`}>
                  <span>📍</span> Google Maps アクセス案内
                </div>
                <p className={`text-xs font-semibold ${isCyberTheme ? 'text-[#f4eefa]' : 'text-stone-700'}`}>{store.address}</p>
                {store.googleMapUrl ? (
                  <a
                    href={store.googleMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-block px-6 py-2.5 font-bold text-xs shadow-sm tracking-widest transition-colors ${
                      isCyberTheme
                        ? 'text-white rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8]'
                        : 'bg-stone-900 text-white rounded-sm hover:bg-[#a39573]'
                    }`}
                  >
                    Google Maps で場所を開く ↗
                  </a>
                ) : (
                  <p className={isCyberTheme ? 'text-[#ffa8d8]/80 text-[11px]' : 'text-stone-400 text-[11px]'}>最寄り駅からの案内は下記をご覧ください</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 text-xs">
            <div className="space-y-3">
              <h3 className={`font-bold text-sm border-b pb-1 tracking-wider ${
                isCyberTheme ? 'neon-text-pink border-[#ff6fb5]/30' : 'text-[#a39573] border-[#d1b464]/30'
              }`}>
                店舗基本情報
              </h3>
              <p><span className={isCyberTheme ? 'text-[#ffa8d8]' : 'text-stone-400'}>店舗名：</span><span className={`font-semibold ${isCyberTheme ? 'text-[#f4eefa]' : 'text-stone-800'}`}>{store.name}</span></p>
              <p><span className={isCyberTheme ? 'text-[#ffa8d8]' : 'text-stone-400'}>本拠住所：</span><span className={`font-semibold ${isCyberTheme ? 'text-[#f4eefa]' : 'text-stone-800'}`}>{store.address}</span></p>
              <p><span className={isCyberTheme ? 'text-[#ffa8d8]' : 'text-stone-400'}>営業時間：</span><span className={`font-semibold ${isCyberTheme ? 'text-[#f4eefa]' : 'text-stone-800'}`}>{store.businessHours}</span></p>
              <p><span className={isCyberTheme ? 'text-[#ffa8d8]' : 'text-stone-400'}>電話番号：</span><span className={`font-semibold ${isCyberTheme ? 'text-[#f4eefa]' : 'text-stone-800'}`}>{store.phoneNumber}</span></p>
            </div>

            <div className="space-y-3">
              <h3 className={`font-bold text-sm border-b pb-1 tracking-wider ${
                isCyberTheme ? 'neon-text-pink border-[#ff6fb5]/30' : 'text-[#a39573] border-[#d1b464]/30'
              }`}>
                アクセス案内
              </h3>
              <p className={`leading-relaxed whitespace-pre-wrap ${isCyberTheme ? 'text-[#ded1ee]' : 'text-stone-700'}`}>{store.accessInfo}</p>
              <p className={`text-[11px] leading-relaxed pt-2 border-t ${
                isCyberTheme ? 'border-[#ff6fb5]/20 text-[#ffa8d8]/80' : 'border-stone-100 text-stone-500'
              }`}>
                ※道順にお迷いの際や場所がご不明な場合は、お気軽に店舗お電話（<span className={`font-bold ${isCyberTheme ? 'text-[#f4eefa]' : 'text-stone-700'}`}>{store.phoneNumber}</span>）までお問い合わせください。スタッフがご案内いたします。
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

