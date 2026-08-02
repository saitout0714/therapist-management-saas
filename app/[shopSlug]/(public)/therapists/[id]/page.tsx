'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Header } from '../../../../../components/store/Header';
import { Footer } from '../../../../../components/store/Footer';
import { fetchStoreConfig, fetchTherapistDetail, fetchBlogArticles } from '../../../../../lib/storeApi';
import { StoreConfig, Therapist, BlogArticle } from '../../../../../types/store';
import { MOCK_STORE, MOCK_THERAPISTS, MOCK_BLOG_ARTICLES } from '../../../../../mock/specialgrade';

export default function TherapistDetailPage({
  params,
}: {
  params: Promise<{ shopSlug: string; id: string }>;
}) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const therapistId = resolvedParams.id;

  const [store, setStore] = useState<StoreConfig>(MOCK_STORE);
  const [therapist, setTherapist] = useState<Therapist | null>(null);
  const [blogs, setBlogs] = useState<BlogArticle[]>([]);

  useEffect(() => {
    async function loadData() {
      const storeConfig = await fetchStoreConfig(shopSlug);
      setStore(storeConfig);
      const detail = await fetchTherapistDetail(therapistId);
      setTherapist(detail);
      const bList = await fetchBlogArticles(storeConfig.id, therapistId);
      setBlogs(bList);
    }
    loadData();
  }, [shopSlug, therapistId]);

  const currentTherapist = therapist || MOCK_THERAPISTS[0];

  return (
    <div className="min-h-screen bg-[#faf9f5] text-stone-800 flex flex-col font-serif">
      <Header store={store} />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-12 w-full">
        <div className="bg-white rounded-sm border border-[#d1b464]/30 overflow-hidden shadow-sm p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* 写真＆ギャラリー */}
            <div className="space-y-4">
              <div className="aspect-[3/4] w-full rounded-sm overflow-hidden bg-stone-100 border border-stone-200 relative">
                <img
                  src={currentTherapist.avatarUrl}
                  alt={currentTherapist.name}
                  className="w-full h-full object-cover"
                />
                {currentTherapist.badge && (
                  <span className="absolute top-3 left-3 bg-[#d1b464] text-white font-bold text-[10px] px-3 py-1 rounded-sm shadow-sm tracking-wider">
                    {currentTherapist.badge}
                  </span>
                )}
              </div>

              {currentTherapist.images.length > 1 && (
                <div className="grid grid-cols-3 gap-2">
                  {currentTherapist.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`${currentTherapist.name}-${idx}`}
                      className="aspect-square rounded-sm object-cover border border-stone-200 hover:opacity-90 cursor-pointer transition-opacity"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* プロフィール情報 */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-stone-800 tracking-wider">{currentTherapist.name}</h1>
                  <span className="text-sm font-semibold text-[#a39573]">({currentTherapist.age}歳)</span>
                </div>
                <p className="text-xs font-semibold text-stone-600 tracking-wide">
                  T{currentTherapist.height}cm / {currentTherapist.bustCup}カップ {currentTherapist.threeSize && `(${currentTherapist.threeSize})`}
                </p>
              </div>

              {/* タグ一覧 */}
              <div className="flex flex-wrap gap-1.5">
                {currentTherapist.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-medium bg-[#faf7f0] text-[#a39573] px-3 py-1 rounded-sm border border-[#d1b464]/30"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              {/* メッセージ */}
              <div className="bg-[#faf7f0] rounded-sm p-4 border border-[#d1b464]/20 space-y-2">
                <h3 className="text-xs font-bold text-[#a39573] tracking-widest uppercase">
                  MESSAGE
                </h3>
                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed italic tracking-wider">
                  "{currentTherapist.comment}"
                </p>
              </div>

              {/* 出勤状況 */}
              <div className="bg-[#faf7f0] rounded-sm p-4 border border-[#d1b464]/20 space-y-2">
                <h3 className="text-xs font-bold text-[#a39573] tracking-widest uppercase">
                  本日の出勤状況
                </h3>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-800 font-bold">13:00 ～ 22:00</span>
                  <span className="text-xs bg-[#d1b464] text-white px-2.5 py-0.5 rounded-sm font-medium tracking-wider">
                    予約受付中
                  </span>
                </div>
              </div>

              {/* 指名予約アクション */}
              <Link
                href={`/${shopSlug}/reserve?therapistId=${currentTherapist.id}`}
                className="block w-full py-3.5 text-center bg-gradient-to-r from-[#d1b464] to-[#a39573] text-white font-bold text-xs rounded-sm shadow-md hover:brightness-105 transition-all tracking-widest"
              >
                {currentTherapist.name} さんを指名予約する
              </Link>
            </div>
          </div>

          {/* 個人ブログ */}
          {blogs.length > 0 && (
            <div className="mt-12 border-t border-stone-200 pt-8 space-y-4">
              <h2 className="text-lg font-bold text-stone-800 tracking-wider">
                {currentTherapist.name} の日記
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {blogs.map((b) => (
                  <Link
                    key={b.id}
                    href={`/${shopSlug}/diary/${b.id}`}
                    className="bg-[#faf7f0] p-4 rounded-sm border border-[#d1b464]/20 hover:border-[#a39573] transition-colors"
                  >
                    <div className="text-[10px] text-stone-400 mb-1">{b.publishedAt}</div>
                    <h3 className="font-bold text-xs text-stone-800 hover:text-[#a39573] transition-colors leading-snug">
                      {b.title}
                    </h3>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer store={store} />
    </div>
  );
}

