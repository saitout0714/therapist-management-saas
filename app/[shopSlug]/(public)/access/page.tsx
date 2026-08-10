'use client';

import React, { useState, useEffect, use } from 'react';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { ThemeProvider } from '../../../../components/store/ThemeProvider';
import { fetchStoreConfig, fetchStoreRooms, RoomInfo } from '../../../../lib/storeApi';
import { StoreConfig } from '../../../../types/store';
import { MOCK_STORE } from '../../../../mock/specialgrade';
import { MOCK_ONYANKO_STORE } from '../../../../mock/onyankospa';

export default function AccessPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const isOnyanko = shopSlug === 'onyankospa';
  const [store, setStore] = useState<StoreConfig>(isOnyanko ? MOCK_ONYANKO_STORE : MOCK_STORE);
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
      <div className={`min-h-screen flex flex-col ${
        isCyberTheme ? 'cyber-bg text-stone-100 font-sans' : 'bg-[#faf9f5] text-stone-800 font-serif'
      }`}>
      <Header store={store} />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-8">
          <h1 className={`text-2xl font-bold tracking-widest ${isCyberTheme ? 'neon-text-pink' : 'text-stone-800'}`}>Access</h1>
          <span className={`inline-block text-xs border-t px-4 pt-1 mt-1 tracking-widest ${
            isCyberTheme ? 'text-[#ff2a8d] border-[#ff007f]' : 'text-[#a39573] border-stone-800'
          }`}>
            アクセス・店舗案内
          </span>
        </div>

        <div className={`p-6 sm:p-8 space-y-6 ${
          isCyberTheme
            ? 'cyber-card rounded-xl border-[#ff007f]/40'
            : 'bg-white rounded-sm border border-[#d1b464]/30 shadow-sm'
        }`}>

          {/* 複数ルームが登録されている場合の表示 */}
          {rooms.length > 0 ? (
            <div className="space-y-6">
              <h2 className={`font-bold text-sm border-b pb-2 tracking-wider flex items-center gap-2 ${
                isCyberTheme ? 'neon-text-pink border-[#ff007f]/40' : 'text-[#a39573] border-[#d1b464]/40'
              }`}>
                <span>🏠</span> ルーム案内（全{rooms.length}拠点）
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className={`p-5 rounded-xl border space-y-3 ${
                      isCyberTheme
                        ? 'bg-[#050014]/90 border-[#ff007f]/30'
                        : 'bg-[#faf7f0] border-[#d1b464]/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className={`font-bold text-sm ${isCyberTheme ? 'neon-text-pink' : 'text-stone-800'}`}>
                        🏠 {room.name}
                      </h3>
                      {room.displayName && (
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                          isCyberTheme ? 'bg-[#ff007f]/20 text-pink-200 border-[#ff007f]/40' : 'bg-[#d1b464]/20 text-[#a39573] border-[#d1b464]/30'
                        }`}>
                          {room.displayName}
                        </span>
                      )}
                    </div>

                    {room.address && (
                      <p className={`text-xs ${isCyberTheme ? 'text-white' : 'text-stone-700'}`}>
                        <span className={isCyberTheme ? 'text-pink-300' : 'text-stone-400'}>住所：</span>
                        {room.address}
                      </p>
                    )}

                    {room.memo && (
                      <p className={`text-xs leading-relaxed whitespace-pre-wrap ${isCyberTheme ? 'text-pink-100/90' : 'text-stone-600'}`}>
                        {room.memo}
                      </p>
                    )}

                    {room.googleMapUrl && (
                      <div className="pt-2">
                        <a
                          href={room.googleMapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-block px-4 py-2 font-bold text-xs shadow-sm tracking-widest transition-colors ${
                            isCyberTheme
                              ? 'bg-[#ff007f] hover:bg-[#ff2a8d] text-white rounded-full shadow-[0_0_10px_rgba(255,0,127,0.5)]'
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
                ? 'bg-[#050014]/90 border-[#ff007f]/40 text-pink-100'
                : 'bg-[#faf7f0] border-[#d1b464]/30 text-stone-500'
            }`}>
              <div className="text-center space-y-3">
                <div className={`font-bold text-lg tracking-wider flex items-center justify-center gap-2 ${
                  isCyberTheme ? 'neon-text-pink' : 'text-[#a39573]'
                }`}>
                  <span>📍</span> Google Maps アクセス案内
                </div>
                <p className={`text-xs font-semibold ${isCyberTheme ? 'text-white' : 'text-stone-700'}`}>{store.address}</p>
                {store.googleMapUrl ? (
                  <a
                    href={store.googleMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-block px-6 py-2.5 font-bold text-xs shadow-sm tracking-widest transition-colors ${
                      isCyberTheme
                        ? 'bg-[#ff007f] hover:bg-[#ff2a8d] text-white rounded-full shadow-[0_0_12px_rgba(255,0,127,0.5)]'
                        : 'bg-stone-900 text-white rounded-sm hover:bg-[#a39573]'
                    }`}
                  >
                    Google Maps で場所を開く ↗
                  </a>
                ) : (
                  <p className={isCyberTheme ? 'text-pink-300/80 text-[11px]' : 'text-stone-400 text-[11px]'}>最寄り駅からの案内は下記をご覧ください</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 text-xs">
            <div className="space-y-3">
              <h3 className={`font-bold text-sm border-b pb-1 tracking-wider ${
                isCyberTheme ? 'neon-text-pink border-[#ff007f]/30' : 'text-[#a39573] border-[#d1b464]/30'
              }`}>
                店舗基本情報
              </h3>
              <p><span className={isCyberTheme ? 'text-pink-300' : 'text-stone-400'}>店舗名：</span><span className={`font-semibold ${isCyberTheme ? 'text-white' : 'text-stone-800'}`}>{store.name}</span></p>
              <p><span className={isCyberTheme ? 'text-pink-300' : 'text-stone-400'}>本拠住所：</span><span className={`font-semibold ${isCyberTheme ? 'text-white' : 'text-stone-800'}`}>{store.address}</span></p>
              <p><span className={isCyberTheme ? 'text-pink-300' : 'text-stone-400'}>営業時間：</span><span className={`font-semibold ${isCyberTheme ? 'text-white' : 'text-stone-800'}`}>{store.businessHours}</span></p>
              <p><span className={isCyberTheme ? 'text-pink-300' : 'text-stone-400'}>電話番号：</span><span className={`font-semibold ${isCyberTheme ? 'text-white' : 'text-stone-800'}`}>{store.phoneNumber}</span></p>
            </div>

            <div className="space-y-3">
              <h3 className={`font-bold text-sm border-b pb-1 tracking-wider ${
                isCyberTheme ? 'neon-text-pink border-[#ff007f]/30' : 'text-[#a39573] border-[#d1b464]/30'
              }`}>
                アクセス案内
              </h3>
              <p className={`leading-relaxed whitespace-pre-wrap ${isCyberTheme ? 'text-pink-100' : 'text-stone-700'}`}>{store.accessInfo}</p>
              <p className={`text-[11px] leading-relaxed pt-2 border-t ${
                isCyberTheme ? 'border-[#ff007f]/20 text-pink-300/80' : 'border-stone-100 text-stone-500'
              }`}>
                ※道順にお迷いの際や場所がご不明な場合は、お気軽に店舗お電話（<span className={`font-bold ${isCyberTheme ? 'text-white' : 'text-stone-700'}`}>{store.phoneNumber}</span>）までお問い合わせください。スタッフがご案内いたします。
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

