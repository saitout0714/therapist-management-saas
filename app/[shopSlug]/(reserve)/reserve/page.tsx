'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { MOCK_STORE, MOCK_THERAPISTS, MOCK_SYSTEM_MENU } from '../../../../mock/specialgrade';

export default function ReservePage({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string }>;
  searchParams?: Promise<{ therapistId?: string }>;
}) {
  const resolvedParams = use(params);
  const resolvedSearchParams = searchParams ? use(searchParams) : {};
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const initialTherapistId = resolvedSearchParams.therapistId || '';

  const [selectedTherapistId, setSelectedTherapistId] = useState<string>(initialTherapistId);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(MOCK_SYSTEM_MENU[0].courses[1].id);
  const [reserveDate, setReserveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reserveTime, setReserveTime] = useState<string>('15:00');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header store={MOCK_STORE} />

      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-300">
            24時間 WEB予約
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            簡単3ステップでご予約を承ります
          </p>
        </div>

        {isSubmitted ? (
          <div className="bg-slate-900/80 rounded-3xl border border-rose-500/40 p-8 text-center space-y-4 shadow-2xl animate-fadeIn">
            <div className="w-16 h-16 bg-rose-600/20 border border-rose-500 rounded-full flex items-center justify-center mx-auto text-2xl">
              🎉
            </div>
            <h2 className="text-xl font-bold text-white">予約の申し込みを完了しました！</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              ご入力いただいたお電話番号宛てに、スタッフより確認のお電話またはSMSをお送りいたします。しばらくお待ちくださいませ。
            </p>
            <div className="pt-4">
              <Link
                href={`/${shopSlug}`}
                className="inline-block px-8 py-3 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-full text-slate-200 transition-colors"
              >
                トップページへ戻る
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-slate-900/80 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6"
          >
            {/* 1. セラピスト選択 */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-rose-300 border-l-2 border-rose-500 pl-2">
                1. セラピストのご指名
              </label>
              <select
                value={selectedTherapistId}
                onChange={(e) => setSelectedTherapistId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-semibold text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="">フリー（おまかせ指名）</option>
                {MOCK_THERAPISTS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.age}歳 / T{t.height})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. コース選択 */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-rose-300 border-l-2 border-rose-500 pl-2">
                2. コースの選択
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {MOCK_SYSTEM_MENU[0].courses.map((course) => {
                  const isSelected = selectedCourseId === course.id;
                  return (
                    <button
                      type="button"
                      key={course.id}
                      onClick={() => setSelectedCourseId(course.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-rose-950/40 border-rose-500 shadow-md shadow-rose-900/30'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-100">{course.name}</div>
                      <div className="text-sm font-extrabold text-rose-400 mt-1">
                        ¥{course.price.toLocaleString()}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. 日時選択 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-rose-300 border-l-2 border-rose-500 pl-2">
                  ご希望日
                </label>
                <input
                  type="date"
                  value={reserveDate}
                  onChange={(e) => setReserveDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-semibold text-slate-200 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-rose-300 border-l-2 border-rose-500 pl-2">
                  ご希望スタート時間
                </label>
                <select
                  value={reserveTime}
                  onChange={(e) => setReserveTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-semibold text-slate-200 focus:outline-none focus:border-rose-500"
                >
                  {['12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '24:00'].map((time) => (
                    <option key={time} value={time}>
                      {time} ～
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. お客様情報 */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  お名前（カタカナ可）<span className="text-rose-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  placeholder="例: サトウ タロウ"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  お電話番号（ハイフンなし）<span className="text-rose-500 ml-1">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="例: 09012345678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>
            </div>

            {/* 送信ボタン */}
            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-rose-600/30 hover:scale-[1.01] transition-transform"
            >
              予約内容を送信する
            </button>
          </form>
        )}
      </main>

      <Footer store={MOCK_STORE} />
    </div>
  );
}
