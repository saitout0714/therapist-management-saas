'use client';

import React, { use } from 'react';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { DiarySection } from '../../../../components/store/DiarySection';
import { MOCK_STORE, MOCK_BLOG_ARTICLES } from '../../../../mock/specialgrade';

export default function DiaryPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';

  return (
    <div className="min-h-screen bg-[#faf9f5] text-stone-800 flex flex-col font-serif">
      <Header store={MOCK_STORE} />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-stone-800 tracking-widest">DIARY</h1>
          <span className="inline-block text-xs text-[#a39573] border-t border-stone-800 px-4 pt-1 mt-1 tracking-widest">
            写メ日記 一覧
          </span>
        </div>

        <DiarySection articles={MOCK_BLOG_ARTICLES} storeSlug={shopSlug} />
      </main>

      <Footer store={MOCK_STORE} />
    </div>
  );
}
