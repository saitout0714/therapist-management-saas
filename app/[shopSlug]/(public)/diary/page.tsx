'use client';

import React, { useState, useEffect, use } from 'react';
import { Header } from '../../../../components/store/Header';
import { Footer } from '../../../../components/store/Footer';
import { DiarySection } from '../../../../components/store/DiarySection';
import { fetchStoreConfig, fetchBlogArticles } from '../../../../lib/storeApi';
import { StoreConfig, BlogArticle } from '../../../../types/store';
import { MOCK_STORE, MOCK_BLOG_ARTICLES } from '../../../../mock/specialgrade';
import { MOCK_ONYANKO_STORE, MOCK_ONYANKO_BLOG_ARTICLES } from '../../../../mock/onyankospa';

export default function DiaryPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const isOnyanko = shopSlug === 'onyankospa';
  const [store, setStore] = useState<StoreConfig>(isOnyanko ? MOCK_ONYANKO_STORE : MOCK_STORE);
  const [articles, setArticles] = useState<BlogArticle[]>(isOnyanko ? MOCK_ONYANKO_BLOG_ARTICLES : MOCK_BLOG_ARTICLES);

  useEffect(() => {
    async function loadData() {
      const storeConfig = await fetchStoreConfig(shopSlug);
      setStore(storeConfig);
      const bList = await fetchBlogArticles(storeConfig.id);
      setArticles(bList);
    }
    loadData();
  }, [shopSlug]);

  const isCyberTheme = shopSlug === 'onyankospa';

  return (
    <div className={`min-h-screen flex flex-col ${
      isCyberTheme ? 'cyber-bg text-stone-100 font-sans' : 'bg-[#faf9f5] text-stone-800 font-serif'
    }`}>
      <Header store={store} />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-8">
          <h1 className={`text-2xl font-bold tracking-widest ${isCyberTheme ? 'neon-text-pink' : 'text-stone-800'}`}>DIARY</h1>
          <span className={`inline-block text-xs border-t px-4 pt-1 mt-1 tracking-widest ${
            isCyberTheme ? 'text-[#ff2a8d] border-[#ff007f]' : 'text-[#a39573] border-stone-800'
          }`}>
            写メ日記 一覧
          </span>
        </div>

        <DiarySection articles={articles} storeSlug={shopSlug} />
      </main>

      <Footer store={store} />
    </div>
  );
}

