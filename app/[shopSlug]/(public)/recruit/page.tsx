'use client';

import React from 'react';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { MOCK_STORE } from '../../../../mock/specialgrade';

export default function RecruitPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header store={MOCK_STORE} />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-300">
            セラピスト求人募集
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            高収入・最高環境で一緒に働きませんか？未経験歓迎！
          </p>
        </div>

        <div className="bg-slate-900/80 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="bg-gradient-to-r from-rose-950/60 to-pink-950/60 p-6 rounded-2xl border border-rose-500/30 text-center space-y-2">
            <h2 className="text-lg font-bold text-rose-300">✨ 地域最高水準のバック率 ＆ 全額日払い対応 ✨</h2>
            <p className="text-xs text-slate-300">
              ノルマ・ペナルティ一切なし！アットホームで快適な完全個室マンションルーム完備。
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="font-bold text-slate-400">職種</span>
              <span className="sm:col-span-2 text-slate-200">アロマセラピスト・トリートメント施術</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="font-bold text-slate-400">資格</span>
              <span className="sm:col-span-2 text-slate-200">18歳以上（高校生不可）、未経験者大歓迎！</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="font-bold text-slate-400">給与</span>
              <span className="sm:col-span-2 text-slate-200">日給 30,000円 ～ 80,000円可能（全額日払いOK）</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="font-bold text-slate-400">勤務時間</span>
              <span className="sm:col-span-2 text-slate-200">12:00 ～ 翌5:00 (週1日・3時間～OKの自由シフト制)</span>
            </div>
          </div>

          <div className="text-center pt-4">
            <a
              href={`tel:${MOCK_STORE.phoneNumber}`}
              className="inline-block px-8 py-3.5 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold text-xs rounded-full shadow-lg shadow-rose-600/30 hover:scale-105 transition-transform"
            >
              電話で今すぐ応募・体験入店申込 ({MOCK_STORE.phoneNumber})
            </a>
          </div>
        </div>
      </main>

      <Footer store={MOCK_STORE} />
    </div>
  );
}
