'use client';

import React, { useState, useEffect, use } from 'react';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { fetchStoreConfig } from '../../../../lib/storeApi';
import { StoreConfig } from '../../../../types/store';
import { MOCK_STORE } from '../../../../mock/specialgrade';

export default function RecruitPage({ params }: { params: Promise<{ shopSlug: string }> }) {
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
    <div className="min-h-screen bg-[#faf9f5] text-stone-800 flex flex-col font-serif">
      <Header store={store} />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-stone-800 tracking-widest">
            セラピスト求人募集
          </h1>
          <span className="inline-block text-xs text-[#a39573] border-t border-stone-800 px-4 pt-1 mt-1 tracking-widest">
            高収入・最高環境で一緒に働きませんか？未経験歓迎！
          </span>
        </div>

        <div className="bg-white rounded-sm border border-[#d1b464]/30 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="bg-[#faf7f0] p-6 rounded-sm border border-[#d1b464]/30 text-center space-y-2">
            <h2 className="text-base font-bold text-[#a39573] tracking-wider">
              ✨ 地域最高水準のバック率 ＆ 全額日払い対応 ✨
            </h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              ノルマ・ペナルティ一切なし！アットホームで快適な完全個室マンションルーム完備。
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 p-3.5 bg-[#faf7f0] rounded-sm border border-[#d1b464]/20">
              <span className="font-bold text-stone-500">職種</span>
              <span className="sm:col-span-2 text-stone-800 font-semibold">アロマセラピスト・トリートメント施術</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 p-3.5 bg-[#faf7f0] rounded-sm border border-[#d1b464]/20">
              <span className="font-bold text-stone-500">資格</span>
              <span className="sm:col-span-2 text-stone-800 font-semibold">18歳以上（高校生不可）、未経験者大歓迎！</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 p-3.5 bg-[#faf7f0] rounded-sm border border-[#d1b464]/20">
              <span className="font-bold text-stone-500">給与</span>
              <span className="sm:col-span-2 text-stone-800 font-semibold">日給 30,000円 ～ 80,000円可能（全額日払いOK）</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 p-3.5 bg-[#faf7f0] rounded-sm border border-[#d1b464]/20">
              <span className="font-bold text-stone-500">勤務時間</span>
              <span className="sm:col-span-2 text-stone-800 font-semibold">12:00 ～ 翌5:00 (週1日・3時間～OKの自由シフト制)</span>
            </div>
          </div>

          <div className="text-center pt-4">
            <a
              href={`tel:${store.phoneNumber}`}
              className="inline-block px-8 py-3.5 bg-gradient-to-r from-[#d1b464] to-[#a39573] text-white font-bold text-xs rounded-sm shadow-md hover:brightness-105 transition-all tracking-widest"
            >
              電話で今すぐ応募・体験入店申込 ({store.phoneNumber})
            </a>
          </div>
        </div>
      </main>

      <Footer store={store} />
    </div>
  );
}

