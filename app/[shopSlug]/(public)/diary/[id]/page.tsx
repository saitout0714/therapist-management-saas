'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '../../../../../components/store/Header';
import { Footer } from '../../../../../components/store/Footer';
import { fetchStoreConfig, fetchBlogArticleDetail } from '../../../../../lib/storeApi';
import { StoreConfig, BlogArticle } from '../../../../../types/store';
import { BLANK_STORE } from '../../../../../mock/specialgrade';
import { BLANK_ONYANKO_STORE } from '../../../../../mock/onyankospa';
import { DIARY_FEATURE_ENABLED } from '../../../../../lib/featureFlags';

export default function DiaryDetailPage({
  params,
}: {
  params: Promise<{ shopSlug: string; id: string }>;
}) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const isOnyanko = shopSlug === 'onyankospa';
  const blogId = resolvedParams.id;
  const router = useRouter();

  const [store, setStore] = useState<StoreConfig>(isOnyanko ? BLANK_ONYANKO_STORE : BLANK_STORE);
  const [article, setArticle] = useState<BlogArticle | null>(null);

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
      const detail = await fetchBlogArticleDetail(blogId);
      setArticle(detail);
    }
    loadData();
  }, [shopSlug, blogId]);

  if (!DIARY_FEATURE_ENABLED) return null;

  if (!article) {
    return (
      <div className="min-h-screen bg-[#faf9f5] text-stone-800 flex flex-col font-serif">
        <Header store={store} />
        <main className="flex-1 max-w-3xl mx-auto px-4 py-24 w-full text-center">
          <p className="text-xs text-stone-400 tracking-widest">読み込み中...</p>
        </main>
        <Footer store={store} />
      </div>
    );
  }

  const currentArticle = article;

  return (
    <div className="min-h-screen bg-[#faf9f5] text-stone-800 flex flex-col font-serif">
      <Header store={store} />

      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 w-full">
        <article className="bg-white rounded-sm border border-[#d1b464]/30 p-6 sm:p-10 shadow-sm space-y-6">
          {/* ヘッダー情報 */}
          <div className="border-b border-stone-200 pb-6 space-y-4">
            <div className="flex items-center justify-between text-xs text-stone-400">
              <span className="bg-[#faf7f0] text-[#a39573] border border-[#d1b464]/30 px-3 py-1 rounded-sm font-medium">
                セラピスト日記
              </span>
              <span>{currentArticle.publishedAt}</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-stone-800 leading-tight tracking-wider">
              {currentArticle.title}
            </h1>

            <Link
              href={`/${shopSlug}/therapists/${currentArticle.therapistId}`}
              className="inline-flex items-center gap-3 p-2 bg-[#faf7f0] rounded-sm border border-[#d1b464]/30 hover:border-[#a39573] transition-colors"
            >
              <img
                src={currentArticle.therapistAvatar}
                alt={currentArticle.therapistName}
                className="w-10 h-10 rounded-full object-cover border border-[#d1b464]/30"
              />
              <div>
                <div className="text-xs font-bold text-stone-800">{currentArticle.therapistName}</div>
                <div className="text-[10px] text-[#a39573]">プロフィールを見る →</div>
              </div>
            </Link>
          </div>

          {/* アイキャッチ画像 */}
          {currentArticle.eyeCatchUrl && (
            <div className="rounded-sm overflow-hidden border border-stone-200">
              <img
                src={currentArticle.eyeCatchUrl}
                alt={currentArticle.title}
                className="w-full max-h-96 object-cover"
              />
            </div>
          )}

          {/* 本文 */}
          <div className="text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-line space-y-4 tracking-wider">
            {currentArticle.content}
          </div>

          {/* アクション */}
          <div className="border-t border-stone-200 pt-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <Link
              href={`/${shopSlug}/diary`}
              className="text-xs font-semibold text-stone-500 hover:text-[#a39573]"
            >
              ← 日記一覧へ戻る
            </Link>

            <Link
              href={`/${shopSlug}/reserve?therapistId=${currentArticle.therapistId}`}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-[#d1b464] to-[#a39573] text-white font-bold text-xs rounded-sm shadow-md text-center hover:brightness-105 transition-all tracking-widest"
            >
              {currentArticle.therapistName} さんを指名予約する
            </Link>
          </div>
        </article>
      </main>

      <Footer store={store} />
    </div>
  );
}

