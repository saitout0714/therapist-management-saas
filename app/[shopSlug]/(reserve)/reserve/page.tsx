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
    <div className="min-h-screen bg-[#faf9f5] text-stone-800 flex flex-col font-serif">
      <Header store={MOCK_STORE} />

      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-stone-800 tracking-widest">Reserve</h1>
          <span className="inline-block text-xs text-[#a39573] border-t border-stone-800 px-4 pt-1 mt-1 tracking-widest">
            24時間 WEB予約
          </span>
        </div>

        {isSubmitted ? (
          <div className="bg-white rounded-sm border border-[#d1b464]/50 p-8 text-center space-y-4 shadow-sm animate-fadeIn">
            <div className="w-16 h-16 bg-[#faf7f0] border border-[#d1b464] rounded-full flex items-center justify-center mx-auto text-2xl">
              🎉
            </div>
            <h2 className="text-xl font-bold text-stone-800">予約の申し込みを完了しました！</h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              ご入力いただいたお電話番号宛てに、スタッフより確認のお電話またはSMSをお送りいたします。しばらくお待ちくださいませ。
            </p>
            <div className="pt-4">
              <Link
                href={`/${shopSlug}`}
                className="inline-block px-8 py-3 bg-[#a39573] text-xs font-bold rounded-sm text-white transition-colors tracking-widest"
              >
                トップページへ戻る
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-sm border border-[#d1b464]/30 p-6 sm:p-8 shadow-sm space-y-6"
          >
            {/* 1. セラピスト選択 */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-[#a39573] border-b border-[#d1b464]/30 pb-1 tracking-wider">
                1. セラピストのご指名
              </label>
              <select
                value={selectedTherapistId}
                onChange={(e) => setSelectedTherapistId(e.target.value)}
                className="w-full bg-[#faf7f0] border border-[#d1b464]/30 rounded-sm px-4 py-3 text-xs font-semibold text-stone-800 focus:outline-none focus:border-[#a39573]"
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
              <label className="block text-xs font-bold text-[#a39573] border-b border-[#d1b464]/30 pb-1 tracking-wider">
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
                      className={`p-3 rounded-sm border text-left transition-all ${
                        isSelected
                          ? 'bg-[#faf7f0] border-[#a39573] shadow-sm'
                          : 'bg-white border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div className="text-xs font-bold text-stone-800">{course.name}</div>
                      <div className="text-sm font-extrabold text-[#a39573] mt-1">
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
                <label className="block text-xs font-bold text-[#a39573] border-b border-[#d1b464]/30 pb-1 tracking-wider">
                  ご希望日
                </label>
                <input
                  type="date"
                  value={reserveDate}
                  onChange={(e) => setReserveDate(e.target.value)}
                  className="w-full bg-[#faf7f0] border border-[#d1b464]/30 rounded-sm px-4 py-3 text-xs font-semibold text-stone-800 focus:outline-none focus:border-[#a39573]"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#a39573] border-b border-[#d1b464]/30 pb-1 tracking-wider">
                  ご希望スタート時間
                </label>
                <select
                  value={reserveTime}
                  onChange={(e) => setReserveTime(e.target.value)}
                  className="w-full bg-[#faf7f0] border border-[#d1b464]/30 rounded-sm px-4 py-3 text-xs font-semibold text-stone-800 focus:outline-none focus:border-[#a39573]"
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
            <div className="space-y-4 pt-2 border-t border-stone-200">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-700">
                  お名前（カタカナ可）<span className="text-[#a39573] ml-1">*</span>
                </label>
                <input
                  type="text"
                  placeholder="例: サトウ タロウ"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-[#faf7f0] border border-[#d1b464]/30 rounded-sm px-4 py-3 text-xs text-stone-800 focus:outline-none focus:border-[#a39573]"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-700">
                  お電話番号（ハイフンなし）<span className="text-[#a39573] ml-1">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="例: 09012345678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-[#faf7f0] border border-[#d1b464]/30 rounded-sm px-4 py-3 text-xs text-stone-800 focus:outline-none focus:border-[#a39573]"
                  required
                />
              </div>
            </div>

            {/* 送信ボタン */}
            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-[#d1b464] to-[#a39573] text-white font-bold text-xs rounded-sm shadow-md hover:brightness-105 transition-all tracking-widest"
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
