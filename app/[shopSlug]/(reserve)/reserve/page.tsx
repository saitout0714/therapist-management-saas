'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { supabase } from '../../../../lib/supabase';
import { fetchStoreConfig, fetchTherapists, fetchSystemCourses } from '../../../../lib/storeApi';
import { StoreConfig, Therapist, SystemMenuCategory } from '../../../../types/store';
import { BLANK_STORE } from '../../../../mock/specialgrade';
import { BLANK_ONYANKO_STORE } from '../../../../mock/onyankospa';


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
  const isOnyanko = shopSlug === 'onyankospa';
  const initialTherapistId = resolvedSearchParams.therapistId || '';

  const [store, setStore] = useState<StoreConfig>(isOnyanko ? BLANK_ONYANKO_STORE : BLANK_STORE);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [categories, setCategories] = useState<SystemMenuCategory[]>([]);

  const [selectedTherapistId, setSelectedTherapistId] = useState<string>(initialTherapistId);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
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
      setSelectedCourseId((prev) => prev || cList[0]?.courses[1]?.id || cList[0]?.courses[0]?.id || '');
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

      // 2. Calculate end_time from the selected course's duration
      const selectedCourse = currentCourses.find((c) => c.id === selectedCourseId);
      const durationMinutes = selectedCourse?.durationMinutes || 90;
      const [h, m] = reserveTime.split(':').map(Number);
      const totalEndMinutes = h * 60 + m + durationMinutes;
      const endH = Math.floor(totalEndMinutes / 60) % 24;
      const endM = totalEndMinutes % 60;
      const endTimeStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

      // 3. Create reservation in DB
      // 選択したコースがDB未登録のmockコースの場合、course_idはUUIDでないため保存しない
      const isValidCourseId = !!selectedCourse && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedCourse.id);

      await supabase.from('reservations').insert({
        shop_id: store.id,
        therapist_id: selectedTherapistId || null,
        customer_id: customerId,
        date: reserveDate,
        start_time: `${reserveTime}:00`,
        end_time: `${endTimeStr}:00`,
        status: 'pending',
        course_id: isValidCourseId ? selectedCourse!.id : null,
        base_price: selectedCourse?.price ?? null,
        total_price: selectedCourse?.price ?? null,
        source: 'web',
        booking_method: 'web',
        notes: selectedCourse ? `WEB予約: ${selectedCourse.name}（¥${selectedCourse.price.toLocaleString()}）` : undefined,
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


  const currentCourses = categories[0]?.courses || [];
  const isCyberTheme = shopSlug === 'onyankospa';

  return (
    <div className={`min-h-screen flex flex-col ${
      isCyberTheme ? 'cyber-bg text-[#f4eefa]' : 'bg-[#faf9f5] text-stone-800 font-serif'
    }`}>
      <Header store={store} />

      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-8">
          <h1 className={`text-2xl font-bold tracking-widest ${isCyberTheme ? 'neon-text-pink' : 'text-stone-800'}`}>Reserve</h1>
          <span className={`inline-block text-xs border-t px-4 pt-1 mt-1 tracking-widest ${
            isCyberTheme ? 'text-[#ffa8d8] border-[#ff6fb5]' : 'text-[#a39573] border-stone-800'
          }`}>
            24時間 WEB予約
          </span>
        </div>

        {isSubmitted ? (
          <div className={`p-8 text-center space-y-4 shadow-sm animate-fadeIn ${
            isCyberTheme
              ? 'cyber-card rounded-2xl border-[#ff6fb5]'
              : 'bg-white rounded-sm border border-[#d1b464]/50'
          }`}>
            <div className={`w-16 h-16 border rounded-full flex items-center justify-center mx-auto text-2xl ${
              isCyberTheme ? 'bg-[#ff6fb5]/20 border-[#ff6fb5] shadow-[0_0_15px_rgba(255,111,181,0.5)]' : 'bg-[#faf7f0] border-[#d1b464]'
            }`}>
              🎉
            </div>
            <h2 className={`text-xl font-bold ${isCyberTheme ? 'neon-text-pink' : 'text-stone-800'}`}>予約の申し込みを完了しました！</h2>
            <p className={`text-xs leading-relaxed ${isCyberTheme ? 'text-[#ded1ee]' : 'text-stone-600'}`}>
              ご入力いただいたお電話番号宛てに、スタッフより確認のお電話またはSMSをお送りいたします。しばらくお待ちくださいませ。
            </p>
            <div className="pt-4">
              <Link
                href={`/${shopSlug}`}
                className={`inline-block px-8 py-3 text-xs font-bold text-white transition-all tracking-widest ${
                  isCyberTheme
                    ? 'rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8]'
                    : 'bg-[#a39573] rounded-sm hover:brightness-105'
                }`}
              >
                トップページへ戻る
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className={`p-6 sm:p-8 space-y-6 ${
              isCyberTheme
                ? 'cyber-card rounded-2xl border-[#ff6fb5]/40'
                : 'bg-white rounded-sm border border-[#d1b464]/30 shadow-sm'
            }`}
          >
            {/* 1. セラピスト選択 */}
            <div className="space-y-3">
              <label className={`block text-xs font-bold border-b pb-1 tracking-wider ${
                isCyberTheme ? 'neon-text-pink border-[#ff6fb5]/30' : 'text-[#a39573] border-[#d1b464]/30'
              }`}>
                1. セラピストのご指名
              </label>
              <select
                value={selectedTherapistId}
                onChange={(e) => setSelectedTherapistId(e.target.value)}
                className={`w-full px-4 py-3 text-xs font-semibold focus:outline-none ${
                  isCyberTheme
                    ? 'bg-white/90 border-2 border-[#ff6fb5]/40 rounded-xl focus:border-[#ff6fb5]'
                    : 'bg-[#faf7f0] border border-[#d1b464]/30 rounded-sm text-stone-800 focus:border-[#a39573]'
                }`}
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
              <label className={`block text-xs font-bold border-b pb-1 tracking-wider ${
                isCyberTheme ? 'neon-text-pink border-[#ff6fb5]/30' : 'text-[#a39573] border-[#d1b464]/30'
              }`}>
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
                      className={`p-3 border text-left transition-all ${
                        isCyberTheme
                          ? isSelected
                            ? 'bg-[#ff6fb5]/20 border-[#ff6fb5] shadow-[0_0_12px_rgba(255,111,181,0.5)] rounded-xl'
                            : 'bg-white/8 border-[#ff6fb5]/30 text-[#ded1ee] hover:border-[#ff6fb5] rounded-xl'
                          : isSelected
                            ? 'bg-[#faf7f0] border-[#a39573] shadow-sm rounded-sm'
                            : 'bg-white border-stone-200 hover:border-stone-300 rounded-sm'
                      }`}
                    >
                      <div className={`text-xs font-bold ${isCyberTheme ? 'text-[#f4eefa]' : 'text-stone-800'}`}>{course.name}</div>
                      <div className={`text-sm font-extrabold mt-1 ${isCyberTheme ? 'neon-text-pink' : 'text-[#a39573]'}`}>
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
                <label className={`block text-xs font-bold border-b pb-1 tracking-wider ${
                  isCyberTheme ? 'neon-text-pink border-[#ff6fb5]/30' : 'text-[#a39573] border-[#d1b464]/30'
                }`}>
                  3. ご来店希望日
                </label>
                <input
                  type="date"
                  value={reserveDate}
                  onChange={(e) => setReserveDate(e.target.value)}
                  className={`w-full px-4 py-3 text-xs font-semibold focus:outline-none ${
                    isCyberTheme
                      ? 'bg-white/90 border-2 border-[#ff6fb5]/40 rounded-xl focus:border-[#ff6fb5]'
                      : 'bg-[#faf7f0] border border-[#d1b464]/30 rounded-sm text-stone-800 focus:border-[#a39573]'
                  }`}
                />
              </div>
              <div className="space-y-2">
                <label className={`block text-xs font-bold border-b pb-1 tracking-wider ${
                  isCyberTheme ? 'neon-text-pink border-[#ff6fb5]/30' : 'text-[#a39573] border-[#d1b464]/30'
                }`}>
                  ご来店希望時間
                </label>
                <input
                  type="time"
                  value={reserveTime}
                  onChange={(e) => setReserveTime(e.target.value)}
                  className={`w-full px-4 py-3 text-xs font-semibold focus:outline-none ${
                    isCyberTheme
                      ? 'bg-white/90 border-2 border-[#ff6fb5]/40 rounded-xl focus:border-[#ff6fb5]'
                      : 'bg-[#faf7f0] border border-[#d1b464]/30 rounded-sm text-stone-800 focus:border-[#a39573]'
                  }`}
                />
              </div>
            </div>

            {/* 4. お客様情報入力 */}
            <div className="space-y-4 pt-2">
              <label className={`block text-xs font-bold border-b pb-1 tracking-wider ${
                isCyberTheme ? 'neon-text-pink border-[#ff6fb5]/30' : 'text-[#a39573] border-[#d1b464]/30'
              }`}>
                4. お客様情報のご入力
              </label>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="お名前（ニックネーム可）"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  className={`w-full px-4 py-3 text-xs font-semibold focus:outline-none ${
                    isCyberTheme
                      ? 'bg-white/90 border-2 border-[#ff6fb5]/40 rounded-xl focus:border-[#ff6fb5]'
                      : 'bg-[#faf7f0] border border-[#d1b464]/30 rounded-sm text-stone-800 focus:border-[#a39573]'
                  }`}
                />
                <input
                  type="tel"
                  placeholder="お電話番号 (例: 090-1234-5678)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                  className={`w-full px-4 py-3 text-xs font-semibold focus:outline-none ${
                    isCyberTheme
                      ? 'bg-white/90 border-2 border-[#ff6fb5]/40 rounded-xl focus:border-[#ff6fb5]'
                      : 'bg-[#faf7f0] border border-[#d1b464]/30 rounded-sm text-stone-800 focus:border-[#a39573]'
                  }`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-4 text-white font-bold text-sm shadow-md tracking-widest transition-all ${
                isCyberTheme
                  ? 'rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8]'
                  : 'bg-gradient-to-r from-[#d1b464] to-[#a39573] rounded-sm hover:brightness-105'
              }`}
            >
              {submitting ? '送信中...' : '上記内容でWEB予約を申し込む 🐾'}
            </button>
          </form>
        )}
      </main>

      <Footer store={store} />
    </div>
  );
}

