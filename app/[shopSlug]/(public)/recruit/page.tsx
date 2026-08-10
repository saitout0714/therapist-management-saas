'use client';

import React, { useState, useEffect, use } from 'react';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { fetchStoreConfig } from '../../../../lib/storeApi';
import { StoreConfig } from '../../../../types/store';
import { MOCK_STORE } from '../../../../mock/specialgrade';
import { MOCK_ONYANKO_STORE } from '../../../../mock/onyankospa';

export default function RecruitPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const isOnyanko = shopSlug === 'onyankospa';
  const [store, setStore] = useState<StoreConfig>(isOnyanko ? MOCK_ONYANKO_STORE : MOCK_STORE);

  useEffect(() => {
    async function loadData() {
      const storeConfig = await fetchStoreConfig(shopSlug);
      setStore(storeConfig);
    }
    loadData();
  }, [shopSlug]);

  const isCyberTheme = shopSlug === 'onyankospa';

  const rInfo = store.recruitInfo;
  const title = rInfo?.title || 'セラピスト求人募集';
  const catchphrase = rInfo?.catchphrase || '🐾 地域最高水準のバック率 ＆ 全額日払い対応 🐾';
  const description = rInfo?.description || 'ノルマ・ペナルティ一切なし！アットホームで快適な完全個室マンションルーム完備。';
  const jobType = rInfo?.jobType || 'アロマセラピスト・トリートメント施術';
  const qualification = rInfo?.qualification || '18歳以上（高校生不可）、未経験者大歓迎！';
  const salary = rInfo?.salary || '日給 30,000円 ～ 80,000円可能（全額日払いOK）';
  const hours = rInfo?.hours || '12:00 ～ 翌5:00 (週1日・3時間～OKの自由シフト制)';
  const notes = rInfo?.notes;

  return (
    <div className={`min-h-screen flex flex-col ${
      isCyberTheme ? 'cyber-bg text-stone-100 font-sans' : 'bg-[#faf9f5] text-stone-800 font-serif'
    }`}>
      <Header store={store} />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-8">
          <h1 className={`text-2xl font-bold tracking-widest ${isCyberTheme ? 'neon-text-pink' : 'text-stone-800'}`}>
            {title}
          </h1>
          <span className={`inline-block text-xs border-t px-4 pt-1 mt-1 tracking-widest ${
            isCyberTheme ? 'text-[#ff2a8d] border-[#ff007f]' : 'text-[#a39573] border-stone-800'
          }`}>
            高収入・最高環境で一緒に働きませんか？未経験歓迎！
          </span>
        </div>

        <div className={`p-6 sm:p-8 space-y-6 ${
          isCyberTheme
            ? 'cyber-card rounded-xl border-[#ff007f]/40'
            : 'bg-white rounded-sm border border-[#d1b464]/30 shadow-sm'
        }`}>
          <div className={`p-6 rounded-xl border text-center space-y-2 ${
            isCyberTheme
              ? 'bg-[#050014]/90 border-[#ff007f]/40'
              : 'bg-[#faf7f0] border-[#d1b464]/30'
          }`}>
            <h2 className={`text-base font-bold tracking-wider ${
              isCyberTheme ? 'neon-text-pink' : 'text-[#a39573]'
            }`}>
              {catchphrase}
            </h2>
            <p className={`text-xs leading-relaxed ${isCyberTheme ? 'text-pink-100' : 'text-stone-600'}`}>
              {description}
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className={`grid grid-cols-1 sm:grid-cols-3 p-3.5 border ${
              isCyberTheme ? 'bg-[#050014]/80 border-[#ff007f]/30 rounded-xl' : 'bg-[#faf7f0] border-[#d1b464]/20 rounded-sm'
            }`}>
              <span className={`font-bold ${isCyberTheme ? 'text-pink-300' : 'text-stone-500'}`}>職種</span>
              <span className={`sm:col-span-2 font-semibold ${isCyberTheme ? 'text-white' : 'text-stone-800'}`}>{jobType}</span>
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-3 p-3.5 border ${
              isCyberTheme ? 'bg-[#050014]/80 border-[#ff007f]/30 rounded-xl' : 'bg-[#faf7f0] border-[#d1b464]/20 rounded-sm'
            }`}>
              <span className={`font-bold ${isCyberTheme ? 'text-pink-300' : 'text-stone-500'}`}>資格</span>
              <span className={`sm:col-span-2 font-semibold ${isCyberTheme ? 'text-white' : 'text-stone-800'}`}>{qualification}</span>
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-3 p-3.5 border ${
              isCyberTheme ? 'bg-[#050014]/80 border-[#ff007f]/30 rounded-xl' : 'bg-[#faf7f0] border-[#d1b464]/20 rounded-sm'
            }`}>
              <span className={`font-bold ${isCyberTheme ? 'text-pink-300' : 'text-stone-500'}`}>給与</span>
              <span className={`sm:col-span-2 font-semibold ${isCyberTheme ? 'text-white' : 'text-stone-800'}`}>{salary}</span>
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-3 p-3.5 border ${
              isCyberTheme ? 'bg-[#050014]/80 border-[#ff007f]/30 rounded-xl' : 'bg-[#faf7f0] border-[#d1b464]/20 rounded-sm'
            }`}>
              <span className={`font-bold ${isCyberTheme ? 'text-pink-300' : 'text-stone-500'}`}>勤務時間</span>
              <span className={`sm:col-span-2 font-semibold ${isCyberTheme ? 'text-white' : 'text-stone-800'}`}>{hours}</span>
            </div>
            {notes && (
              <div className={`grid grid-cols-1 sm:grid-cols-3 p-3.5 border ${
                isCyberTheme ? 'bg-[#050014]/80 border-[#ff007f]/30 rounded-xl' : 'bg-[#faf7f0] border-[#d1b464]/20 rounded-sm'
              }`}>
                <span className={`font-bold ${isCyberTheme ? 'text-pink-300' : 'text-stone-500'}`}>備考・アピール</span>
                <span className={`sm:col-span-2 font-semibold ${isCyberTheme ? 'text-white' : 'text-stone-800'}`}>{notes}</span>
              </div>
            )}
          </div>

          <div className="text-center pt-4">
            <a
              href={`tel:${rInfo?.phone || store.phoneNumber}`}
              className={`inline-block px-8 py-3.5 text-white font-bold text-xs shadow-md tracking-widest transition-all ${
                isCyberTheme
                  ? 'bg-[#ff007f] hover:bg-[#ff2a8d] rounded-full shadow-[0_0_15px_rgba(255,0,127,0.6)] animate-neon-pulse'
                  : 'bg-gradient-to-r from-[#d1b464] to-[#a39573] rounded-sm hover:brightness-105'
              }`}
            >
              電話で今すぐ応募・体験入店申込 ({rInfo?.phone || store.phoneNumber}) 🐾
            </a>
          </div>
        </div>
      </main>

      <Footer store={store} />
    </div>
  );
}

