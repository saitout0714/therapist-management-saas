'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { MOCK_STORE, MOCK_SYSTEM_MENU } from '../../../../mock/specialgrade';

export default function SystemPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';

  return (
    <div className="min-h-screen bg-[#faf9f5] text-stone-800 flex flex-col font-serif">
      <Header store={MOCK_STORE} />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-stone-800 tracking-widest">System</h1>
          <span className="inline-block text-xs text-[#a39573] border-t border-stone-800 px-4 pt-1 mt-1 tracking-widest">
            システム・料金案内
          </span>
        </div>

        <div className="space-y-8">
          {MOCK_SYSTEM_MENU.map((cat, idx) => (
            <div
              key={idx}
              className="bg-white rounded-sm border border-[#d1b464]/30 p-6 shadow-sm space-y-4"
            >
              <h2 className="text-base font-bold text-[#a39573] border-b border-stone-200 pb-2 tracking-wider">
                {cat.categoryName}
              </h2>
              {cat.description && (
                <p className="text-xs text-stone-600 tracking-wide">{cat.description}</p>
              )}

              <div className="space-y-3">
                {cat.courses.map((course) => (
                  <div
                    key={course.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#faf7f0] p-4 rounded-sm border border-[#d1b464]/20 gap-2"
                  >
                    <div>
                      <h3 className="font-bold text-stone-800 text-sm tracking-wider">{course.name}</h3>
                      {course.description && (
                        <p className="text-xs text-stone-500 mt-0.5">{course.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-extrabold text-stone-900 tracking-wider">
                        ¥{course.price.toLocaleString()}
                      </span>
                      <span className="text-xs text-stone-500 ml-1">(税込)</span>
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
            className="inline-block px-10 py-3.5 bg-gradient-to-r from-[#d1b464] to-[#a39573] text-white font-bold text-xs rounded-sm shadow-md hover:brightness-105 transition-all tracking-widest"
          >
            この料金でWEB予約する
          </Link>
        </div>
      </main>

      <Footer store={MOCK_STORE} />
    </div>
  );
}
