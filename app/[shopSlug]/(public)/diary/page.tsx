'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '../../../../components/store/Header';
import { PageHeading } from '../../../../components/store/SectionHeading';
import { Footer } from '../../../../components/store/Footer';
import { DiarySection } from '../../../../components/store/DiarySection';
import { fetchStoreConfig, fetchBlogArticles } from '../../../../lib/storeApi';
import { StoreConfig, BlogArticle } from '../../../../types/store';
import { BLANK_STORE } from '../../../../mock/specialgrade';
import { BLANK_ONYANKO_STORE } from '../../../../mock/onyankospa';
import { DIARY_FEATURE_ENABLED } from '../../../../lib/featureFlags';

import { CyberParallaxBackground } from '../../../../components/store/CyberParallaxBackground';

export default function DiaryPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const isOnyanko = shopSlug === 'onyankospa';
  const router = useRouter();
  const [store, setStore] = useState<StoreConfig>(isOnyanko ? BLANK_ONYANKO_STORE : BLANK_STORE);
  const [articles, setArticles] = useState<BlogArticle[]>([]);

  // セラピスト日記は作成中のため、URLを直接開かれてもTOPへ戻す
  useEffect(() => {
    if (!DIARY_FEATURE_ENABLED) {
      router.replace(`/${shopSlug}`);
    }
  }, [router, shopSlug]);

  useEffect(() => {
    if (!DIARY_FEATURE_ENABLED) return;
    async function loadData() {
      const storeConfig = await fetchStoreConfig(shopSlug);
      setStore(storeConfig);
      const bList = await fetchBlogArticles(storeConfig.id);
      setArticles(bList);
    }
    loadData();
  }, [shopSlug]);

  if (!DIARY_FEATURE_ENABLED) return null;

  const isCyberTheme = shopSlug === 'onyankospa';
  const isLuxuryTheme = shopSlug === 'specialgrade';

  return (
    <div className={`min-h-screen flex flex-col relative ${
      isCyberTheme ? 'cyber-bg text-[#f4eefa]' : isLuxuryTheme ? 'luxury-marble-bg luxury-body' : 'bg-[#faf9f5] text-stone-800 font-serif'
    }`}>
      {isCyberTheme && <CyberParallaxBackground variant="medium" pageType="diary" />}
      <Header store={store} />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-12 w-full relative z-10">
        <PageHeading title="Diary" subtitle="写メ日記 一覧" isCyber={isCyberTheme} isLuxury={isLuxuryTheme} className="mb-8" />

        <DiarySection articles={articles} storeSlug={shopSlug} />
      </main>

      <Footer store={store} />
    </div>
  );
}

