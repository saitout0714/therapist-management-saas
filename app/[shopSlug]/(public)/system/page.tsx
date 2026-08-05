'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { ThemeProvider } from '../../../../components/store/ThemeProvider';
import { fetchStoreConfig, fetchSystemCourses } from '../../../../lib/storeApi';
import { StoreConfig, SystemMenuCategory } from '../../../../types/store';
import { MOCK_STORE, MOCK_SYSTEM_MENU } from '../../../../mock/specialgrade';

export default function SystemPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const [store, setStore] = useState<StoreConfig>(MOCK_STORE);
  const [categories, setCategories] = useState<SystemMenuCategory[]>(MOCK_SYSTEM_MENU);

  useEffect(() => {
    async function loadData() {
      const storeConfig = await fetchStoreConfig(shopSlug);
      setStore(storeConfig);
      const cList = await fetchSystemCourses(storeConfig.id);
      setCategories(cList);
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
        <div className="text-center mb-10">
          <h1 className={`text-2xl font-bold tracking-widest ${isCyberTheme ? 'neon-text-pink' : 'text-stone-800'}`}>System</h1>
          <span className={`inline-block text-xs border-t px-4 pt-1 mt-1 tracking-widest ${
            isCyberTheme ? 'text-[#ff2a8d] border-[#ff007f]' : 'text-[#a39573] border-stone-800'
          }`}>
            システム・料金案内
          </span>
        </div>

        <div className="space-y-8">
          {categories.map((cat, idx) => (
            <div
              key={idx}
              className={`p-6 space-y-4 ${
                isCyberTheme
                  ? 'cyber-card rounded-xl border-[#ff007f]/40'
                  : 'bg-white rounded-sm border border-[#d1b464]/30 shadow-sm'
              }`}
            >
              <h2 className={`text-base font-bold border-b pb-2 tracking-wider ${
                isCyberTheme ? 'neon-text-pink border-[#ff007f]/30' : 'text-[#a39573] border-stone-200'
              }`}>
                🐾 {cat.categoryName}
              </h2>
              {cat.description && (
                <p className={`text-xs tracking-wide ${isCyberTheme ? 'text-pink-100' : 'text-stone-600'}`}>
                  {cat.description}
                </p>
              )}

              <div className="space-y-3">
                {cat.courses.map((course) => (
                  <div
                    key={course.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border gap-3 transition-colors ${
                      isCyberTheme
                        ? 'bg-[#050014]/90 border-[#ff007f]/30 hover:border-[#ff007f] rounded-xl'
                        : 'bg-[#faf7f0] border-[#d1b464]/20 hover:border-[#d1b464] rounded-sm'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-bold text-sm sm:text-base tracking-wider ${
                          isCyberTheme ? 'text-white' : 'text-stone-800'
                        }`}>
                          {course.name}
                        </h3>
                        {course.durationMinutes > 0 && (
                          <span className={`text-[11px] font-bold px-2 py-0.5 border ${
                            isCyberTheme
                              ? 'bg-[#ff007f]/20 text-pink-300 border-[#ff007f]/50 rounded-full'
                              : 'bg-[#d1b464]/20 text-[#a39573] border-[#d1b464]/40 rounded-sm'
                          }`}>
                            {course.durationMinutes}分
                          </span>
                        )}
                      </div>
                      {course.description && (
                        <p className={`text-xs leading-relaxed tracking-wide ${
                          isCyberTheme ? 'text-pink-100/90' : 'text-stone-600'
                        }`}>
                          {course.description}
                        </p>
                      )}
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <span className={`text-lg sm:text-xl font-extrabold tracking-wider ${
                        isCyberTheme ? 'neon-text-pink' : 'text-stone-900'
                      }`}>
                        ¥{course.price.toLocaleString()}
                      </span>
                      <span className={`text-xs ml-1 ${isCyberTheme ? 'text-pink-300' : 'text-stone-500'}`}>(税込)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href={`/${shopSlug}/reserve`}
            className={`inline-block px-10 py-3.5 font-bold text-xs shadow-md transition-all tracking-widest ${
              isCyberTheme
                ? 'bg-[#ff007f] hover:bg-[#ff2a8d] text-white rounded-full shadow-[0_0_20px_rgba(255,0,127,0.7)] animate-neon-pulse'
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

