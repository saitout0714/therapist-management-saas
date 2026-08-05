'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Header } from '../../../components/store/Header';
import { Footer } from '../../../components/store/Footer';
import { HeroBanner } from '../../../components/store/HeroBanner';
import { HeroBannerSlider } from '../../../components/store/HeroBannerSlider';
import { MobileFloatingBar } from '../../../components/store/MobileFloatingBar';
import { TherapistCard } from '../../../components/store/TherapistCard';
import { TherapistFilter } from '../../../components/store/TherapistFilter';
import { NewsList } from '../../../components/store/NewsList';
import { DiarySection } from '../../../components/store/DiarySection';
import { ThemeProvider } from '../../../components/store/ThemeProvider';
import {
  fetchStoreConfig,
  fetchCampaigns,
  fetchTherapists,
  fetchBlogArticles,
  fetchNewsList,
  fetchConfirmedShifts,
} from '../../../lib/storeApi';
import { StoreConfig, Campaign, Therapist, BlogArticle, NewsItem, ConfirmedShift } from '../../../types/store';
import { MOCK_STORE, MOCK_CAMPAIGNS, MOCK_THERAPISTS, MOCK_BLOG_ARTICLES, MOCK_NEWS } from '../../../mock/specialgrade';

export default function StoreHomePage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  
  const [store, setStore] = useState<StoreConfig>(MOCK_STORE);
  const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS);
  const [therapists, setTherapists] = useState<Therapist[]>(MOCK_THERAPISTS);
  const [confirmedShifts, setConfirmedShifts] = useState<ConfirmedShift[]>([]);
  const [blogs, setBlogs] = useState<BlogArticle[]>(MOCK_BLOG_ARTICLES);
  const [news, setNews] = useState<NewsItem[]>(MOCK_NEWS);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const storeConfig = await fetchStoreConfig(shopSlug);
      setStore(storeConfig);

      const todayStr = new Date().toISOString().split('T')[0];

      const [c, t, b, n, shifts] = await Promise.all([
        fetchCampaigns(storeConfig.id),
        fetchTherapists(storeConfig.id),
        fetchBlogArticles(storeConfig.id),
        fetchNewsList(storeConfig.id),
        fetchConfirmedShifts(storeConfig.id, todayStr, todayStr),
      ]);
      setCampaigns(c);
      setTherapists(t);
      setBlogs(b);
      setNews(n);
      setConfirmedShifts(shifts);
    }
    loadData();
  }, [shopSlug]);

  // 本日部屋割り確定済みのセラピストIDセット
  const confirmedTherapistIds = new Set(confirmedShifts.map((s) => s.therapistId));

  // 確定シフトがあるセラピストのみ出勤（データがない場合はモック表示維持）
  const todayTherapists = confirmedShifts.length > 0
    ? therapists.filter((t) => confirmedTherapistIds.has(t.id))
    : therapists;

  const allTags = Array.from(new Set(todayTherapists.flatMap((t) => t.tags)));

  const filteredTherapists = selectedTag
    ? todayTherapists.filter((t) => t.tags.includes(selectedTag))
    : todayTherapists;

  const isCyberTheme = shopSlug === 'onyankospa';
  const sectionOrder = store.layoutSections && store.layoutSections.length > 0
    ? store.layoutSections
    : ['hero', 'today_shifts', 'therapists', 'diary', 'news', 'system', 'access'];

  const renderSection = (secType: string) => {
    switch (secType) {
      case 'hero':
        return <HeroBanner key="hero" campaigns={campaigns} store={store} />;

      case 'today_shifts':
      case 'therapists':
        return (
          <section key={secType} className={`py-12 border-b ${isCyberTheme ? 'bg-[#050014]/60 border-[#ff007f]/30' : 'bg-[#faf7f0] border-[#d1b464]/20'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-8">
                <h2 className={`text-2xl font-bold tracking-widest ${isCyberTheme ? 'neon-text-pink' : 'text-stone-800'}`}>Schedule</h2>
                <span className={`inline-block text-xs border-t px-4 pt-1 mt-1 tracking-widest ${isCyberTheme ? 'text-[#ff2a8d] border-[#ff007f]' : 'text-[#a39573] border-stone-800'}`}>
                  本日の出勤セラピスト
                </span>

                {/* タグによる絞り込み */}
                <TherapistFilter
                  tags={allTags}
                  selectedTag={selectedTag}
                  onSelectTag={setSelectedTag}
                  isCyber={isCyberTheme}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredTherapists.map((therapist) => (
                  <TherapistCard
                    key={therapist.id}
                    therapist={therapist}
                    storeSlug={shopSlug}
                    primaryColor={store.themeColor?.primary}
                  />
                ))}
              </div>

              <div className="text-center mt-10">
                <Link
                  href={`/${shopSlug}/therapists`}
                  className={`inline-block px-8 py-3 text-xs font-bold transition-all shadow-sm tracking-widest ${
                    isCyberTheme
                      ? 'text-white bg-[#ff007f] hover:bg-[#ff2a8d] rounded-full shadow-[0_0_15px_rgba(255,0,127,0.6)]'
                      : 'text-stone-700 bg-white border border-[#d1b464]/50 hover:border-[#a39573]'
                  }`}
                >
                  セラピスト一覧をすべて見る →
                </Link>
              </div>
            </div>
          </section>
        );

      case 'diary':
        return (
          <section key="diary" className={`py-12 border-b ${isCyberTheme ? 'bg-[#1a0933]/60 border-[#ff007f]/30' : 'bg-white border-[#d1b464]/20'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-8">
                <h2 className={`text-2xl font-bold tracking-widest ${isCyberTheme ? 'neon-text-pink' : 'text-stone-800'}`}>DIARY</h2>
                <span className={`inline-block text-xs border-t px-4 pt-1 mt-1 tracking-widest ${isCyberTheme ? 'text-[#ff2a8d] border-[#ff007f]' : 'text-[#a39573] border-stone-800'}`}>
                  セラピスト日記
                </span>
              </div>

              <DiarySection articles={blogs} storeSlug={shopSlug} />

              <div className="text-center mt-8">
                <Link
                  href={`/${shopSlug}/diary`}
                  className={`inline-block px-8 py-2.5 text-xs font-semibold transition-all tracking-widest ${
                    isCyberTheme
                      ? 'text-pink-300 border border-[#ff007f] hover:bg-[#ff007f] hover:text-white rounded-full'
                      : 'text-[#a39573] border border-[#a39573] hover:bg-[#a39573] hover:text-white'
                  }`}
                >
                  写メ日記 一覧はこちら
                </Link>
              </div>
            </div>
          </section>
        );

      case 'news':
        return (
          <section key="news" className={`py-12 border-b ${isCyberTheme ? 'bg-[#050014]/80 border-[#ff007f]/30' : 'bg-[#faf7f0] border-[#d1b464]/20'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                  <div className="text-left mb-4">
                    <h3 className={`text-xl font-bold tracking-widest ${isCyberTheme ? 'neon-text-pink' : 'text-stone-800'}`}>Topics</h3>
                    <span className={`inline-block text-xs border-t pr-4 pt-0.5 mt-0.5 tracking-widest ${isCyberTheme ? 'text-[#ff2a8d] border-[#ff007f]' : 'text-[#a39573] border-stone-800'}`}>
                      新着情報
                    </span>
                  </div>
                  <NewsList news={news} storeSlug={shopSlug} />
                </div>

                <div className="space-y-4">
                  <div className="text-left mb-4">
                    <h3 className={`text-xl font-bold tracking-widest ${isCyberTheme ? 'neon-text-pink' : 'text-stone-800'}`}>Twitter</h3>
                    <span className={`inline-block text-xs border-t pr-4 pt-0.5 mt-0.5 tracking-widest ${isCyberTheme ? 'text-[#ff2a8d] border-[#ff007f]' : 'text-[#a39573] border-stone-800'}`}>
                      公式X (Twitter)
                    </span>
                  </div>
                  <div className={`p-6 rounded-md text-center space-y-3 shadow-sm ${isCyberTheme ? 'cyber-card' : 'bg-white border border-[#d1b464]/30'}`}>
                    <p className={`text-xs leading-relaxed ${isCyberTheme ? 'text-pink-100' : 'text-stone-600'}`}>
                      最新の出勤・空き枠情報をリアルタイムで配信中！
                    </p>
                    <a
                      href={store.xUrl || 'https://x.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-block px-6 py-2.5 font-bold text-xs transition-all tracking-widest ${
                        isCyberTheme
                          ? 'bg-[#ff007f] text-white hover:bg-[#ff2a8d] rounded-full shadow-[0_0_10px_rgba(255,0,127,0.5)]'
                          : 'bg-stone-900 text-white rounded-sm hover:bg-stone-800'
                      }`}
                    >
                      公式Xをフォローする
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );

      case 'access':
      case 'system':
        return (
          <section key={secType} className={`py-12 text-center ${isCyberTheme ? 'bg-[#050014]' : 'bg-white'}`}>
            <div className="max-w-4xl mx-auto px-4">
              <h2 className={`text-2xl font-bold tracking-widest mb-1 ${isCyberTheme ? 'neon-text-pink' : 'text-stone-800'}`}>Concept</h2>
              <span className={`inline-block text-xs border-t px-4 pt-1 mb-6 tracking-widest ${isCyberTheme ? 'text-[#ff2a8d] border-[#ff007f]' : 'text-[#a39573] border-stone-800'}`}>
                当店のこだわり
              </span>

              <div className={`p-6 sm:p-10 text-xs sm:text-sm leading-loose tracking-wider text-left space-y-4 ${
                isCyberTheme
                  ? 'cyber-card text-pink-50 rounded-xl'
                  : 'bg-[#faf9f5] border border-[#d1b464]/30 rounded-sm text-stone-700'
              }`}>
                <p className={`font-bold text-center text-base mb-2 ${isCyberTheme ? 'neon-text-pink' : 'text-stone-900'}`}>
                  {isCyberTheme ? '新宿・渋谷エリア極上のサイバーリラクゼーション『おニャンこスパ』' : '赤羽・川口エリアで選ばれ続けるメンズエステへ。'}
                </p>
                <p>
                  {isCyberTheme
                    ? 'メンズエステ「おニャンこスパ」は、都会の喧騒を忘れられる完全個室のネオン×サイバープライベート空間。可愛い猫耳スタイルを纏った魅力あふれるセラピストたちが、貴方の心と体を解きほぐします。'
                    : '赤羽のメンズエステ「Special Grade」は赤羽駅徒歩2分、川口のメンズエステとしても川口駅徒歩3分の好立地。都会の喧騒を忘れられる「完全個室」のプライベート空間で、心身ともに癒しのひとときをお過ごしいただけます。'}
                </p>
                <p>
                  {isCyberTheme
                    ? '当店自慢のアロマオイルを使用した本格密着マッサージは、心地よい温もりとともに極上のリラクゼーションをもたらし、日々の疲れやストレスを優しく癒やします。'
                    : '当店自慢の「ホットオイル」を使用した施術は、温もりとともに深いリラクゼーションをもたらし、疲れた身体と心を優しく包み込みます。さらに丁寧な「リンパ」ケアで日々の疲労やストレスをすっきりと流していきます。'}
                </p>
                <p>
                  {isCyberTheme
                    ? '厳選されたルックスと愛嬌満点のセラピストが、至福のひとときをご提供。24時間いつでもオンラインWEB予約が可能です。'
                    : 'また、セラピストの採用にあたっては「顔やスタイルだけではなく内面も重視して採用をしてます」。そのため、技術だけでなく心遣いにもご満足いただけると自負しております。'}
                </p>
                <p className={`text-center font-semibold pt-2 ${isCyberTheme ? 'text-[#ff007f]' : 'text-[#a39573]'}`}>
                  {isCyberTheme ? '非日常の最高級空間で、特別な密着タイムをお過ごしください。' : '赤羽・川口で特別な時間を、ぜひ当店でご体感ください。'}
                </p>
              </div>
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  // 重複セクションの排除（`today_shifts`と`therapists`など）
  const uniqueSections = Array.from(new Set(sectionOrder));

  return (
    <ThemeProvider store={store}>
      <div className={`min-h-screen flex flex-col selection:bg-[#ff007f] selection:text-white ${isCyberTheme ? 'cyber-bg text-stone-100 font-sans' : 'bg-[#faf9f5] text-stone-800 font-serif'}`}>
      <Header store={store} />

      <main className="flex-1">
        {uniqueSections.map((sec) => renderSection(sec))}
      </main>

      <Footer store={store} />
      <MobileFloatingBar store={store} />
    </div>
    </ThemeProvider>
  );
}

