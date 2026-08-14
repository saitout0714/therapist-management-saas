'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Header } from '../../../../components/store/Header';
import { PageHeading } from '../../../../components/store/SectionHeading';
import { Footer } from '../../../../components/store/Footer';
import { ThemeProvider } from '../../../../components/store/ThemeProvider';
import { fetchStoreConfig, fetchSystemCourses, fetchSystemExtras } from '../../../../lib/storeApi';
import { StoreConfig, SystemMenuCategory } from '../../../../types/store';
import { BLANK_STORE } from '../../../../mock/specialgrade';
import { BLANK_ONYANKO_STORE } from '../../../../mock/onyankospa';

import { CyberParallaxBackground } from '../../../../components/store/CyberParallaxBackground';

export default function SystemPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const isOnyanko = shopSlug === 'onyankospa';
  const [store, setStore] = useState<StoreConfig>(isOnyanko ? BLANK_ONYANKO_STORE : BLANK_STORE);
  const [categories, setCategories] = useState<SystemMenuCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const storeConfig = await fetchStoreConfig(shopSlug);
      setStore(storeConfig);
      const [cList, extras] = await Promise.all([
        fetchSystemCourses(storeConfig.id),
        fetchSystemExtras(storeConfig.id),
      ]);
      setCategories([...cList, ...extras]);
      setLoading(false);
    }
    loadData();
  }, [shopSlug]);

  const isCyberTheme = shopSlug === 'onyankospa';

  /*
   * オプションは複数を組み合わせられるため、単体金額は「〜」の目安表示にする。
   * 指名料金のうち「本指名」はセラピストごとに個別設定できる（therapist_pricing.nomination_fee）ため
   * 同様に「〜」表示にし、フリー・写真指名など固定額の項目はそのまま表示する。
   */
  const isStartingPrice = (cat: SystemMenuCategory, course: SystemMenuCategory['courses'][number]) =>
    cat.categoryName === 'オプション' || course.name === '本指名';

  return (
    <ThemeProvider store={store}>
      <div className={`min-h-screen flex flex-col relative ${
        isCyberTheme ? 'cyber-bg text-[#f4eefa]' : 'bg-[#faf9f5] text-stone-800 font-serif'
      }`}>
        {isCyberTheme && <CyberParallaxBackground variant="medium" pageType="system" />}
        <Header store={store} />

        <main className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full relative z-10">
        <PageHeading title="System" subtitle="システム・料金案内" isCyber={isCyberTheme} className="mb-10" />

        {loading ? (
          <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
            <div className={`w-8 h-8 rounded-full border-2 border-t-transparent animate-spin ${
              isCyberTheme ? 'border-[#ff6fb5]' : 'border-[#d1b464]'
            }`} />
            <span className={`text-xs tracking-widest ${isCyberTheme ? 'text-[#ffa8d8]' : 'text-stone-500'}`}>
              コース料金情報を読み込み中...
            </span>
          </div>
        ) : (
          <div className="space-y-8">
            {categories.map((cat, idx) => (
            <div
              key={idx}
              className={`p-6 space-y-4 ${
                isCyberTheme
                  ? 'cyber-card reveal rounded-xl border-[#ff6fb5]/40'
                  : 'bg-white rounded-sm border border-[#d1b464]/30 shadow-sm'
              }`}
            >
              <h2 className={`text-base font-bold border-b pb-2 tracking-wider ${
                isCyberTheme ? 'neon-text-pink border-[#ff6fb5]/30' : 'text-[#a39573] border-stone-200'
              }`}>
                🐾 {cat.categoryName}
              </h2>
              {cat.description && (
                <p className={`text-xs tracking-wide ${isCyberTheme ? 'text-[#ded1ee]' : 'text-stone-600'}`}>
                  {cat.description}
                </p>
              )}

              <div className="space-y-3">
                {cat.courses.map((course) => (
                  <div
                    key={course.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border gap-3 transition-colors ${
                      isCyberTheme
                        ? 'bg-white/10 border-[#ff6fb5]/30 hover:border-[#ff6fb5] rounded-xl'
                        : 'bg-[#faf7f0] border-[#d1b464]/20 hover:border-[#d1b464] rounded-sm'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-bold text-sm sm:text-base tracking-wider ${
                          isCyberTheme ? 'text-[#f4eefa]' : 'text-stone-800'
                        }`}>
                          {course.name}
                        </h3>
                        {course.durationMinutes > 0 && (
                          <span className={`text-[11px] font-bold px-2 py-0.5 border ${
                            isCyberTheme
                              ? 'bg-[#ff6fb5]/20 text-[#ffa8d8] border-[#ff6fb5]/50 rounded-full'
                              : 'bg-[#d1b464]/20 text-[#a39573] border-[#d1b464]/40 rounded-sm'
                          }`}>
                            {course.durationMinutes}分
                          </span>
                        )}
                      </div>
                      {course.description && (
                        <p className={`text-xs leading-relaxed tracking-wide ${
                          isCyberTheme ? 'text-[#ded1ee]/90' : 'text-stone-600'
                        }`}>
                          {course.description}
                        </p>
                      )}
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <span className={`text-lg sm:text-xl font-extrabold tracking-wider ${
                        isCyberTheme ? 'neon-text-pink' : 'text-stone-900'
                      }`}>
                        ¥{course.price.toLocaleString()}{isStartingPrice(cat, course) ? '〜' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        )}

        <div className="mt-12 text-center">
          <Link
            href={`/${shopSlug}/reserve`}
            className={`inline-block px-10 py-3.5 font-bold text-xs shadow-md transition-all tracking-widest ${
              isCyberTheme
                ? 'text-white rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8]'
                : 'bg-gradient-to-r from-[#d1b464] to-[#a39573] text-white rounded-sm hover:brightness-105'
            }`}
          >
            この料金でWEB予約する 🐾
          </Link>
        </div>
      </main>

      <Footer store={store} />
    </div>
    </ThemeProvider>
  );
}

