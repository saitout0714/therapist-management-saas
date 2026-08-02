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

  const allTags = Array.from(new Set(MOCK_THERAPISTS.flatMap((t) => t.tags)));

  const filteredTherapists = selectedTag
    ? MOCK_THERAPISTS.filter((t) => t.tags.includes(selectedTag))
    : MOCK_THERAPISTS;

  return (
    <div className="min-h-screen bg-[#faf9f5] text-stone-800 flex flex-col font-serif selection:bg-[#d1b464] selection:text-white">
      <Header store={MOCK_STORE} />

      <main className="flex-1">
        {/* メインヒーロー (smart-info & top-welcome & Information) */}
        <HeroBanner campaigns={MOCK_CAMPAIGNS} store={MOCK_STORE} />

        {/* 新人セラピスト / 本日の出勤 (Schedule) セクション */}
        <section className="py-12 bg-[#faf7f0] border-b border-[#d1b464]/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-stone-800 tracking-widest">Schedule</h2>
              <span className="inline-block text-xs text-[#a39573] border-t border-stone-800 px-4 pt-1 mt-1 tracking-widest">
                本日の出勤セラピスト
              </span>

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
                className="inline-block px-8 py-3 text-xs font-bold text-stone-700 bg-white border border-[#d1b464]/50 hover:border-[#a39573] transition-all shadow-sm tracking-widest"
              >
                セラピスト一覧をすべて見る →
              </Link>
            </div>
          </div>
        </section>

        {/* セラピスト日記 (DIARY) */}
        <section className="py-12 bg-white border-b border-[#d1b464]/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-stone-800 tracking-widest">DIARY</h2>
              <span className="inline-block text-xs text-[#a39573] border-t border-stone-800 px-4 pt-1 mt-1 tracking-widest">
                セラピスト日記
              </span>
            </div>

            <DiarySection articles={MOCK_BLOG_ARTICLES} storeSlug={shopSlug} />

            <div className="text-center mt-8">
              <Link
                href={`/${shopSlug}/diary`}
                className="inline-block px-8 py-2.5 text-xs font-semibold text-[#a39573] border border-[#a39573] hover:bg-[#a39573] hover:text-white transition-all tracking-widest"
              >
                写メ日記 一覧はこちら
              </Link>
            </div>
          </div>
        </section>

        {/* Topics (新着情報) ＆ Twitter */}
        <section className="py-12 bg-[#faf7f0] border-b border-[#d1b464]/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="text-left mb-4">
                  <h3 className="text-xl font-bold text-stone-800 tracking-widest">Topics</h3>
                  <span className="inline-block text-xs text-[#a39573] border-t border-stone-800 pr-4 pt-0.5 mt-0.5 tracking-widest">
                    新着情報
                  </span>
                </div>
                <NewsList news={MOCK_NEWS} />
              </div>

              <div className="space-y-4">
                <div className="text-left mb-4">
                  <h3 className="text-xl font-bold text-stone-800 tracking-widest">Twitter</h3>
                  <span className="inline-block text-xs text-[#a39573] border-t border-stone-800 pr-4 pt-0.5 mt-0.5 tracking-widest">
                    公式X (Twitter)
                  </span>
                </div>
                <div className="bg-white p-6 rounded-sm border border-[#d1b464]/30 text-center space-y-3 shadow-sm">
                  <p className="text-xs text-stone-600 leading-relaxed">
                    最新の出勤・空き枠情報をリアルタイムで配信中！
                  </p>
                  <a
                    href={MOCK_STORE.xUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-6 py-2.5 bg-stone-900 text-white font-bold text-xs rounded-sm hover:bg-stone-800 transition-colors tracking-widest"
                  >
                    公式Xをフォローする
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Concept (当店のこだわり) */}
        <section className="py-12 bg-white text-center">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-stone-800 tracking-widest mb-1">Concept</h2>
            <span className="inline-block text-xs text-[#a39573] border-t border-stone-800 px-4 pt-1 mb-6 tracking-widest">
              当店のこだわり
            </span>

            <div className="bg-[#faf9f5] p-6 sm:p-10 border border-[#d1b464]/30 rounded-sm text-xs sm:text-sm text-stone-700 leading-loose tracking-wider text-left space-y-4">
              <p className="font-bold text-center text-stone-900 text-base mb-2">
                赤羽・川口エリアで選ばれ続けるメンズエステへ。
              </p>
              <p>
                赤羽のメンズエステ「Special Grade」は赤羽駅徒歩2分、川口のメンズエステとしても川口駅徒歩3分の好立地。都会の喧騒を忘れられる「完全個室」のプライベート空間で、心身ともに癒しのひとときをお過ごしいただけます。
              </p>
              <p>
                当店自慢の「ホットオイル」を使用した施術は、温もりとともに深いリラクゼーションをもたらし、疲れた身体と心を優しく包み込みます。さらに丁寧な「リンパ」ケアで日々の疲労やストレスをすっきりと流していきます。
              </p>
              <p>
                また、セラピストの採用にあたっては「顔やスタイルだけではなく内面も重視して採用をしてます」。そのため、技術だけでなく心遣いにもご満足いただけると自負しております。
              </p>
              <p className="text-center font-semibold pt-2 text-[#a39573]">
                赤羽・川口で特別な時間を、ぜひ当店でご体感ください。
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer store={MOCK_STORE} />
    </div>
  );
}
