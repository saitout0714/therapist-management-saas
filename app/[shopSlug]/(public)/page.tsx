'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { Header } from '../../../components/store/Header';
import { Footer } from '../../../components/store/Footer';
import { HeroBanner } from '../../../components/store/HeroBanner';
import { TherapistCard } from '../../../components/store/TherapistCard';
import { TherapistFilter } from '../../../components/store/TherapistFilter';
import { NewsList } from '../../../components/store/NewsList';
import { DiarySection } from '../../../components/store/DiarySection';
import {
  MOCK_STORE,
  MOCK_CAMPAIGNS,
  MOCK_THERAPISTS,
  MOCK_NEWS,
  MOCK_BLOG_ARTICLES,
} from '../../../mock/specialgrade';

export default function StoreHomePage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // 全タグの抽出
  const allTags = Array.from(
    new Set(MOCK_THERAPISTS.flatMap((t) => t.tags))
  );

  // フィルタリングされたセラピスト
  const filteredTherapists = selectedTag
    ? MOCK_THERAPISTS.filter((t) => t.tags.includes(selectedTag))
    : MOCK_THERAPISTS;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      <Header store={MOCK_STORE} />

      <main className="flex-1">
        {/* メインヒーロー ＆ バナー */}
        <HeroBanner campaigns={MOCK_CAMPAIGNS} />

        {/* 本日の出勤・セラピストセクション */}
        <section className="py-12 bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-pink-300 to-amber-200">
                本日の出勤セラピスト
              </h2>
              <p className="text-xs text-slate-400 mt-2">
                厳選された最高のセラピストが極上の癒やしをお届けします
              </p>

              {/* タグによる絞り込み */}
              <TherapistFilter
                tags={allTags}
                selectedTag={selectedTag}
                onSelectTag={setSelectedTag}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredTherapists.map((therapist) => (
                <TherapistCard
                  key={therapist.id}
                  therapist={therapist}
                  storeSlug={shopSlug}
                />
              ))}
            </div>

            <div className="text-center mt-10">
              <Link
                href={`/${shopSlug}/therapists`}
                className="inline-block px-8 py-3 text-sm font-bold text-rose-300 border border-rose-500/40 hover:border-rose-500 bg-slate-900/80 rounded-full transition-all shadow-lg hover:shadow-rose-950/40"
              >
                すべてのセラピストを見る →
              </Link>
            </div>
          </div>
        </section>

        {/* セラピスト日記 ＆ お知らせ */}
        <section className="py-12 bg-slate-900/40 border-t border-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* ブログ最新投稿 (2カラム) */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white border-l-4 border-rose-500 pl-3">
                    セラピスト日記
                  </h3>
                  <Link
                    href={`/${shopSlug}/diary`}
                    className="text-xs font-semibold text-rose-400 hover:underline"
                  >
                    日記一覧 →
                  </Link>
                </div>
                <DiarySection articles={MOCK_BLOG_ARTICLES} storeSlug={shopSlug} />
              </div>

              {/* NEWS・お知らせ (1カラム) */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white border-l-4 border-rose-500 pl-3">
                  NEWS・お知らせ
                </h3>
                <NewsList news={MOCK_NEWS} />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer store={MOCK_STORE} />
    </div>
  );
}
