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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header store={MOCK_STORE} />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-300">
            システム・料金案内
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            明朗会計・安心の料金体系でお迎えいたします
          </p>
        </div>

        <div className="space-y-8">
          {MOCK_SYSTEM_MENU.map((cat, idx) => (
            <div
              key={idx}
              className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-4"
            >
              <h2 className="text-lg font-bold text-rose-300 border-b border-slate-800 pb-2">
                {cat.categoryName}
              </h2>
              {cat.description && (
                <p className="text-xs text-slate-400">{cat.description}</p>
              )}

              <div className="space-y-3">
                {cat.courses.map((course) => (
                  <div
                    key={course.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 gap-2"
                  >
                    <div>
                      <h3 className="font-bold text-slate-100 text-sm">{course.name}</h3>
                      {course.description && (
                        <p className="text-xs text-slate-400 mt-0.5">{course.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-300">
                        ¥{course.price.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-400 ml-1">(税込)</span>
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
            className="inline-block px-10 py-4 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold text-sm rounded-full shadow-lg shadow-rose-600/30 hover:scale-105 transition-all"
          >
            この料金でWEB予約する
          </Link>
        </div>
      </main>

      <Footer store={MOCK_STORE} />
    </div>
  );
}
