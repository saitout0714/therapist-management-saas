import React from 'react';
import Link from 'next/link';
import { Header } from '../../../components/store/Header';
import { Footer } from '../../../components/store/Footer';
import { MobileFloatingBar } from '../../../components/store/MobileFloatingBar';
import { HeroBanner } from '../../../components/store/HeroBanner';
import { TherapistCard } from '../../../components/store/TherapistCard';
import { NewsList } from '../../../components/store/NewsList';
import { SectionHeading } from '../../../components/store/SectionHeading';
import { ThemeProvider } from '../../../components/store/ThemeProvider';
import { fetchStoreConfig, fetchCampaigns, fetchTherapists, fetchNewsList } from '../../../lib/storeApi';
import { DIARY_FEATURE_ENABLED } from '../../../lib/featureFlags';

import { CyberParallaxBackground } from '../../../components/store/CyberParallaxBackground';

/**
 * サーバーコンポーネント。
 * 以前は 'use client' + useEffect で取得していたため、クローラに配信される
 * HTMLは店名以外が空（セラピスト・お知らせ・住所・営業時間がすべて空タグ）だった。
 * サーバー側で取得してから描画することで、本文が最初のHTMLに載る。
 * 見た目・レイアウトは変更していない。
 */
export default async function StoreTopPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = await params;
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';

  const store = await fetchStoreConfig(shopSlug);
  const [campaigns, therapists, news] = await Promise.all([
    fetchCampaigns(store.id),
    fetchTherapists(store.id),
    fetchNewsList(store.id),
  ]);

  const isCyberTheme = shopSlug === 'onyankospa';
  const sectionOrder = store.layoutSections || ['hero', 'today_shifts', 'therapists', 'diary', 'system', 'news', 'access'];

  // ネオンテーマの共通ボタン（ピンク→マゼンタ→パープルのグラデーション＋発光）
  const neonBtn =
    'inline-block px-8 py-3 font-bold text-xs tracking-widest text-white rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8]';
  const classicBtn = 'inline-block px-8 py-3 font-bold text-xs tracking-widest text-white rounded-sm shadow-md transition-all bg-stone-900 hover:bg-[#a39573]';

  const renderSection = (sectionName: string) => {
    switch (sectionName) {
      case 'hero':
        return <HeroBanner key="hero" campaigns={campaigns} store={store} />;

      case 'today_shifts':
      case 'therapists':
        return (
          <section
            key="therapists"
            className={`relative overflow-hidden py-16 border-b ${isCyberTheme ? 'border-[#ff6fb5]/20' : 'bg-white border-stone-200'}`}
          >
            {isCyberTheme && (
              <>
                <div className="neon-orb neon-orb-pink animate-orb-slow w-[28rem] h-[28rem] -top-40 -left-32" />
                <div className="neon-orb neon-orb-purple animate-orb-slower w-[24rem] h-[24rem] top-1/3 -right-32" />
              </>
            )}
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
              <SectionHeading title="Therapist" subtitle="出勤セラピスト" isCyber={isCyberTheme} />

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {therapists.map((therapist, idx) => (
                  <TherapistCard key={therapist.id} therapist={therapist} storeSlug={shopSlug} index={idx} />
                ))}
              </div>

              <div className="text-center pt-4">
                <Link href={`/${shopSlug}/therapists`} className={isCyberTheme ? neonBtn : classicBtn}>
                  セラピスト一覧を見る 🐾
                </Link>
              </div>
            </div>
          </section>
        );

      case 'diary':
        if (!DIARY_FEATURE_ENABLED) return null;
        return (
          <section
            key="diary"
            className={`relative overflow-hidden py-16 border-b ${isCyberTheme ? 'border-[#ff6fb5]/20' : 'bg-[#faf9f5] border-stone-200'}`}
          >
            {isCyberTheme && (
              <div className="neon-orb neon-orb-magenta animate-orb-slower w-[30rem] h-[30rem] -bottom-48 left-1/4" />
            )}
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
              <SectionHeading title="Diary" subtitle="写メ日記" isCyber={isCyberTheme} />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {therapists.slice(0, 3).map((therapist) => (
                  <div
                    key={therapist.id}
                    className={`p-5 space-y-3 ${isCyberTheme ? 'cyber-card reveal' : 'rounded-xl border bg-white border-[#d1b464]/30'}`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={therapist.avatarUrl}
                        alt={therapist.name}
                        className="w-11 h-11 rounded-full object-cover border border-[#ff6fb5] shadow-[0_0_12px_rgba(255,111,181,0.5)]"
                      />
                      <div>
                        <div className="font-bold text-xs text-white tracking-wider">{therapist.name}</div>
                        <div className="text-[10px] text-[#ffa8d8] tracking-widest">2026.08.10</div>
                      </div>
                    </div>
                    <p className="text-xs text-[#ded1ee]/90 line-clamp-2 leading-relaxed">
                      {therapist.comment || '本日もたくさんのご来店お待ちしております♪'}
                    </p>
                  </div>
                ))}
              </div>

              <div className="text-center pt-2">
                <Link href={`/${shopSlug}/diary`} className={isCyberTheme ? neonBtn : classicBtn}>
                  写メ日記 一覧はこちら
                </Link>
              </div>
            </div>
          </section>
        );

      case 'news':
        return (
          <section
            key="news"
            className={`relative overflow-hidden py-16 border-b ${isCyberTheme ? 'border-[#ff6fb5]/20' : 'bg-[#faf7f0] border-[#d1b464]/20'}`}
          >
            {isCyberTheme && (
              <div className="neon-orb neon-orb-purple animate-orb-slow w-[26rem] h-[26rem] top-0 -right-40" />
            )}
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-5">
                  <SectionHeading title="Topics" subtitle="新着情報" isCyber={isCyberTheme} align="left" size="sm" />
                  <NewsList news={news} storeSlug={shopSlug} />
                </div>

                <div className="space-y-5">
                  <SectionHeading title="Twitter" subtitle="公式X (Twitter)" isCyber={isCyberTheme} align="left" size="sm" />
                  <div className={`p-6 text-center space-y-4 ${isCyberTheme ? 'cyber-card reveal' : 'rounded-md shadow-sm bg-white border border-[#d1b464]/30'}`}>
                    <p className={`text-xs leading-relaxed ${isCyberTheme ? 'text-[#ded1ee]/90' : 'text-stone-600'}`}>
                      最新の出勤・空き枠情報をリアルタイムで配信中！
                    </p>
                    <a
                      href={store.xUrl || 'https://x.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={
                        isCyberTheme
                          ? 'inline-block px-6 py-2.5 font-bold text-xs tracking-widest text-white rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8]'
                          : 'inline-block px-6 py-2.5 font-bold text-xs tracking-widest bg-stone-900 text-white rounded-sm hover:bg-stone-800 transition-all'
                      }
                    >
                      公式Xをチェック ↗
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );

      case 'concept':
      case 'access':
      case 'system':
        return (
          <section key="concept" className={`relative overflow-hidden py-16 text-center ${isCyberTheme ? '' : 'bg-white'}`}>
            {isCyberTheme && (
              <>
                <div className="neon-orb neon-orb-pink animate-orb-slower w-[24rem] h-[24rem] top-10 -left-32" />
                <div className="neon-orb neon-orb-purple animate-orb-slow w-[22rem] h-[22rem] -bottom-32 right-0" />
              </>
            )}
            <div className="relative z-10 max-w-4xl mx-auto px-4">
              <SectionHeading title="Concept" subtitle="当店のこだわり" isCyber={isCyberTheme} className="mb-8" />

              <div className={`p-6 sm:p-10 text-xs sm:text-sm leading-loose tracking-wider text-left space-y-4 ${
                isCyberTheme
                  ? 'cyber-card reveal text-[#f4eefa]'
                  : 'bg-[#faf9f5] border border-[#d1b464]/30 rounded-sm text-stone-700'
              }`}>
                <p className={`font-bold text-center text-base mb-2 ${isCyberTheme ? 'neon-text-pink font-cyber-display' : 'text-stone-900'}`}>
                  {store.name} {store.catchphrase ? `〜 ${store.catchphrase} 〜` : (isCyberTheme ? '極上のサイバーリラクゼーション' : '選ばれ続けるメンズエステへ')}
                </p>

                {store.description ? (
                  <div className="whitespace-pre-wrap leading-relaxed space-y-2">
                    {store.description}
                  </div>
                ) : (
                  <>
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
                    <p className={`text-center font-semibold pt-2 ${isCyberTheme ? 'text-[#ffa8d8]' : 'text-[#a39573]'}`}>
                      {isCyberTheme ? '非日常の最高級空間で、特別な密着タイムをお過ごしください。' : '赤羽・川口で特別な時間を、ぜひ当店でご体感ください。'}
                    </p>
                  </>
                )}
              </div>
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  const normalizedSections = sectionOrder.map((sec) => {
    if (sec === 'today_shifts') return 'therapists';
    if (sec === 'system' || sec === 'access') return 'concept';
    return sec;
  });
  const uniqueSections = Array.from(new Set(normalizedSections));

  return (
    <ThemeProvider store={store}>
      <div className={`min-h-screen flex flex-col selection:bg-[#ff6fb5] selection:text-white ${isCyberTheme ? 'cyber-bg text-[#f4eefa] relative' : 'bg-[#faf9f5] text-stone-800 font-serif'}`}>
        {isCyberTheme && <CyberParallaxBackground />}
        <Header store={store} />

        <main className="flex-1 relative z-10">
          {uniqueSections.map((sec) => renderSection(sec))}
        </main>

        <Footer store={store} />
        <MobileFloatingBar store={store} />
      </div>
    </ThemeProvider>
  );
}
