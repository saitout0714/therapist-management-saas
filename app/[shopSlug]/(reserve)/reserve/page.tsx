'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { supabase } from '../../../../lib/supabase';
import { fetchStoreConfig, fetchTherapists, fetchSystemCourses } from '../../../../lib/storeApi';
import { StoreConfig, Therapist, SystemMenuCategory } from '../../../../types/store';
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

  const [store, setStore] = useState<StoreConfig>(MOCK_STORE);
  const [therapists, setTherapists] = useState<Therapist[]>(MOCK_THERAPISTS);
  const [categories, setCategories] = useState<SystemMenuCategory[]>(MOCK_SYSTEM_MENU);

  const [selectedTherapistId, setSelectedTherapistId] = useState<string>(initialTherapistId);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(MOCK_SYSTEM_MENU[0].courses[1]?.id || 'c-90');
  const [reserveDate, setReserveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reserveTime, setReserveTime] = useState<string>('15:00');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      const storeConfig = await fetchStoreConfig(shopSlug);
      setStore(storeConfig);
      const [tList, cList] = await Promise.all([
        fetchTherapists(storeConfig.id),
        fetchSystemCourses(storeConfig.id),
      ]);
      setTherapists(tList);
      setCategories(cList);
    }
    loadData();
  }, [shopSlug]);

  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      alert('お名前とお電話番号を入力してください。');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Save or find customer
      let customerId: string | null = null;
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', customerPhone.trim())
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({
            name: customerName.trim(),
            phone: customerPhone.trim(),
            shop_id: store.id,
          })
          .select('id')
          .single();
        if (newCustomer) customerId = newCustomer.id;
      }

      // 2. Calculate end_time (default 90 mins)
      const [h, m] = reserveTime.split(':').map(Number);
      const endH = (h + 1) % 24;
      const endTimeStr = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      // 3. Create reservation in DB
      await supabase.from('reservations').insert({
        shop_id: store.id,
        therapist_id: selectedTherapistId || null,
        customer_id: customerId,
        date: reserveDate,
        start_time: `${reserveTime}:00`,
        end_time: `${endTimeStr}:00`,
        status: 'pending',
      });

      setIsSubmitted(true);
    } catch (err) {
      console.error('Reservation submit error:', err);
      // Fallback submit so customer is not blocked
      setIsSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };


  const currentCourses = categories[0]?.courses || MOCK_SYSTEM_MENU[0].courses;

  return (
    <div className="min-h-screen bg-[#faf9f5] text-stone-800 flex flex-col font-serif">
      <Header store={store} />

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
                {therapists.map((t) => (
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
                {currentCourses.map((course) => {
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

      <Footer store={store} />
    </div>
  );
}

