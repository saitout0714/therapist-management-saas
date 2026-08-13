'use client';

import React, { useState, useEffect, use } from 'react';
import { Header } from '../../../../components/store/Header';
import { PageHeading } from '../../../../components/store/SectionHeading';
import { Footer } from '../../../../components/store/Footer';
import { DiarySection } from '../../../../components/store/DiarySection';
import { fetchStoreConfig, fetchBlogArticles } from '../../../../lib/storeApi';
import { StoreConfig, BlogArticle } from '../../../../types/store';
import { MOCK_STORE, MOCK_BLOG_ARTICLES } from '../../../../mock/specialgrade';
import { MOCK_ONYANKO_STORE, MOCK_ONYANKO_BLOG_ARTICLES } from '../../../../mock/onyankospa';

import { CyberParallaxBackground } from '../../../../components/store/CyberParallaxBackground';

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
    <div className={`min-h-screen flex flex-col relative ${
      isCyberTheme ? 'cyber-bg text-[#f4eefa]' : 'bg-[#faf9f5] text-stone-800 font-serif'
    }`}>
      {isCyberTheme && <CyberParallaxBackground variant="medium" pageType="diary" />}
      <Header store={store} />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-12 w-full relative z-10">
        <PageHeading title="Diary" subtitle="写メ日記 一覧" isCyber={isCyberTheme} className="mb-8" />

        <DiarySection articles={articles} storeSlug={shopSlug} />
      </main>

      <Footer store={store} />
    </div>
  );
}

