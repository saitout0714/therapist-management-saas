import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { headers } from 'next/headers';
import { Header } from '../../../components/store/Header';
import { Footer } from '../../../components/store/Footer';
import { MobileFloatingBar } from '../../../components/store/MobileFloatingBar';
import { HeroBanner } from '../../../components/store/HeroBanner';
import { TherapistCard } from '../../../components/store/TherapistCard';
import { NewsList } from '../../../components/store/NewsList';
import { SectionHeading } from '../../../components/store/SectionHeading';
import { ThemeProvider } from '../../../components/store/ThemeProvider';
import { fetchStoreConfig, fetchCampaigns, fetchTherapists, fetchNewsList, fetchConfirmedShifts, fetchBusinessDayCutoff, getJstBusinessDateStr } from '../../../lib/storeApi';
import { DIARY_FEATURE_ENABLED } from '../../../lib/featureFlags';
import { publicBasePath } from '../../../lib/shopDomains';

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

  const host = (await headers()).get('host');
  const basePath = publicBasePath(host, shopSlug);
  const store = { ...(await fetchStoreConfig(shopSlug)), basePath };

  // 深夜営業のシフトが日付を跨いでも「本日出勤」が正しく判定されるよう、
  // 店舗の営業日切り替え時刻を考慮したJST基準の営業日を使う（他ページと同じ方式）。
  const cutoff = await fetchBusinessDayCutoff(store.id);
  const todayStr = getJstBusinessDateStr(cutoff);

  const [campaigns, therapists, news, todayShifts] = await Promise.all([
    fetchCampaigns(store.id),
    fetchTherapists(store.id),
    fetchNewsList(store.id),
    fetchConfirmedShifts(store.id, todayStr, todayStr),
  ]);

  // 本日シフトが入っているセラピストを「本日の出勤」として表示する（部屋割り未確定でも掲載）
  const todayTherapistIds = new Set(todayShifts.map((s) => s.therapistId));
  const todayTherapists = therapists.filter((t) => todayTherapistIds.has(t.id));

  const isCyberTheme = shopSlug === 'onyankospa';
  const isLuxuryTheme = shopSlug === 'specialgrade';
  const sectionOrder = store.layoutSections || ['hero', 'today_shifts', 'therapists', 'diary', 'system', 'news', 'access'];

  // ネオンテーマの共通ボタン（ピンク→マゼンタ→パープルのグラデーション＋発光）
  const neonBtn =
    'inline-block px-8 py-3 font-bold text-xs tracking-widest text-white rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8]';
  const classicBtn = 'inline-block px-8 py-3 font-bold text-xs tracking-widest text-white rounded-sm shadow-md transition-all bg-stone-900 hover:bg-[#a39573]';
  // ラグジュアリーテーマ：主要CTA（予約）はゴールドのグラデーション塗り、それ以外の
  // 「一覧を見る」等の副次的な導線は細いゴールド枠のアウトラインボタンにして主張を抑える。
  const luxuryPrimaryBtn = 'inline-block px-8 py-3 font-medium text-xs tracking-[0.18em] text-white rounded-full luxury-gold-btn shadow-sm';
  const luxuryOutlineBtn = 'inline-block px-8 py-3 font-medium text-xs tracking-[0.18em] rounded-full luxury-outline-btn';
  const sectionBtn = isCyberTheme ? neonBtn : isLuxuryTheme ? luxuryOutlineBtn : classicBtn;

  // ラグジュアリーヒーローのメインビジュアル。
  // 横長1枚を主役にするので実際に使うのは先頭の1枚だけだが、
  // バナー未登録の店舗でもヒーローが空にならないようセラピスト写真をフォールバックに繋いでいる。
  const luxuryGalleryImages = isLuxuryTheme
    ? [...campaigns.map((c) => c.imageUrl), ...therapists.slice(0, 5).map((t) => t.avatarUrl)]
        .filter(Boolean)
        .slice(0, 5)
    : [];

  const renderSection = (sectionName: string) => {
    switch (sectionName) {
      case 'hero':
        return <HeroBanner key="hero" campaigns={campaigns} store={store} galleryImages={luxuryGalleryImages} />;

      case 'today_shifts':
      case 'therapists':
        return (
          <section
            key="therapists"
            className={`relative overflow-hidden ${
              isCyberTheme
                ? 'py-16 border-b border-[#ff6fb5]/20'
                : isLuxuryTheme
                ? 'py-20 sm:py-28 luxury-pink-bg border-b border-[#c695a2]/25'
                : 'py-16 bg-white border-b border-stone-200'
            }`}
          >
            {isCyberTheme && (
              <>
                <div className="neon-orb neon-orb-pink animate-orb-slow w-[28rem] h-[28rem] -top-40 -left-32" />
                <div className="neon-orb neon-orb-purple animate-orb-slower w-[24rem] h-[24rem] top-1/3 -right-32" />
              </>
            )}
            {isLuxuryTheme && (
              <>
                <div className="luxury-orb luxury-orb-rose w-[30rem] h-[30rem] -top-20 -left-24 animate-orb-slow" />
                <div className="luxury-orb luxury-orb-gold w-[26rem] h-[26rem] top-1/2 -right-24 animate-orb-slower" />
              </>
            )}
            <div className={`relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isLuxuryTheme ? 'space-y-14 sm:space-y-18' : 'space-y-10'}`}>
              <SectionHeading title="Today's Shift" subtitle="本日の出勤" isCyber={isCyberTheme} isLuxury={isLuxuryTheme} />

              {todayTherapists.length > 0 ? (
                <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 ${isLuxuryTheme ? 'gap-5 sm:gap-7' : 'gap-4 sm:gap-6'}`}>
                  {todayTherapists.map((therapist, idx) => (
                    <TherapistCard key={therapist.id} therapist={therapist} storeSlug={shopSlug} basePath={basePath} index={idx} />
                  ))}
                </div>
              ) : (
                <p className={`text-center text-xs tracking-widest ${isCyberTheme ? 'text-[#ded1ee]/80' : isLuxuryTheme ? 'text-[#786f6d]' : 'text-stone-500'}`}>
                  本日出勤のセラピストは現在準備中です。出勤スケジュールをご確認ください。
                </p>
              )}

              <div className="text-center pt-4">
                <Link href={`${basePath}/therapists`} className={sectionBtn}>
                  {isLuxuryTheme ? 'セラピスト一覧を見る' : 'セラピスト一覧を見る 🐾'}
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
            className={`relative overflow-hidden border-b ${isCyberTheme ? 'py-16 border-[#ff6fb5]/20' : isLuxuryTheme ? 'py-20 sm:py-28 luxury-ivory-bg border-[#d8b3bd]/30' : 'py-16 bg-[#faf9f5] border-stone-200'}`}
          >
            {isCyberTheme && (
              <div className="neon-orb neon-orb-magenta animate-orb-slower w-[30rem] h-[30rem] -bottom-48 left-1/4" />
            )}
            {isLuxuryTheme && (
              <div className="luxury-orb luxury-orb-rose w-[28rem] h-[28rem] -bottom-32 left-1/4 animate-orb-slow" />
            )}
            <div className={`relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isLuxuryTheme ? 'space-y-12 sm:space-y-16' : 'space-y-10'}`}>
              <SectionHeading title="Diary" subtitle="写メ日記" isCyber={isCyberTheme} isLuxury={isLuxuryTheme} />

              <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${isLuxuryTheme ? 'gap-6 sm:gap-8' : 'gap-6'}`}>
                {therapists.slice(0, 3).map((therapist) => (
                  <div
                    key={therapist.id}
                    className={`p-6 space-y-3.5 ${
                      isCyberTheme
                        ? 'cyber-card reveal'
                        : isLuxuryTheme
                        ? 'luxury-card !rounded-2xl sm:!rounded-3xl luxury-body'
                        : 'rounded-xl border bg-white border-[#d1b464]/30'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <Image
                        src={therapist.avatarUrl}
                        alt={therapist.name}
                        width={46}
                        height={46}
                        className={`w-11 h-11 rounded-full object-cover border ${
                          isCyberTheme ? 'border-[#ff6fb5] shadow-[0_0_12px_rgba(255,111,181,0.5)]' : isLuxuryTheme ? 'border-[#e2b3b1]/60' : 'border-stone-200'
                        }`}
                      />
                      <div>
                        <div className={`text-xs tracking-wider ${
                          isCyberTheme ? 'font-bold text-white' : isLuxuryTheme ? 'font-medium text-[#2b2827] font-luxury-display' : 'font-bold text-stone-800'
                        }`}>{therapist.name}</div>
                        <div className={`text-[10px] tracking-widest ${isCyberTheme ? 'text-[#ffa8d8]' : isLuxuryTheme ? 'text-[#c5a059]' : 'text-stone-400'}`}>2026.08.10</div>
                      </div>
                    </div>
                    <p className={`text-xs line-clamp-2 leading-relaxed ${isCyberTheme ? 'text-[#ded1ee]/90' : isLuxuryTheme ? 'text-[#464141]' : 'text-stone-600'}`}>
                      {therapist.comment || '本日もたくさんのご来店お待ちしております♪'}
                    </p>
                  </div>
                ))}
              </div>

              <div className="text-center pt-2">
                <Link href={`${basePath}/diary`} className={isCyberTheme ? neonBtn : isLuxuryTheme ? luxuryOutlineBtn : classicBtn}>
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
            className={`relative overflow-hidden border-b ${isCyberTheme ? 'py-16 border-[#ff6fb5]/20' : isLuxuryTheme ? 'py-20 sm:py-28 luxury-blush-bg border-[#c695a2]/25' : 'py-16 bg-[#faf7f0] border-[#d1b464]/20'}`}
          >
            {isCyberTheme && (
              <div className="neon-orb neon-orb-purple animate-orb-slow w-[26rem] h-[26rem] top-0 -right-40" />
            )}
            {isLuxuryTheme && (
              <div className="luxury-orb luxury-orb-gold w-[26rem] h-[26rem] top-0 -right-32 animate-orb-slower" />
            )}
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className={`grid grid-cols-1 lg:grid-cols-3 ${isLuxuryTheme ? 'gap-10 sm:gap-14' : 'gap-8'}`}>
                <div className="lg:col-span-2 space-y-5">
                  <SectionHeading title="Topics" subtitle="新着情報" isCyber={isCyberTheme} isLuxury={isLuxuryTheme} align="left" size="sm" />
                  <NewsList news={news} storeSlug={shopSlug} />
                </div>

                <div className="space-y-5">
                  <SectionHeading title="Twitter" subtitle="公式X (Twitter)" isCyber={isCyberTheme} isLuxury={isLuxuryTheme} align="left" size="sm" />
                  <div className={`p-6 text-center space-y-4 ${
                    isCyberTheme ? 'cyber-card reveal' : isLuxuryTheme ? 'luxury-card !rounded-2xl sm:!rounded-3xl p-8' : 'rounded-md shadow-sm bg-white border border-[#d1b464]/30'
                  }`}>
                    <p className={`text-xs leading-relaxed ${isCyberTheme ? 'text-[#ded1ee]/90' : isLuxuryTheme ? 'text-[#464141]' : 'text-stone-600'}`}>
                      最新の出勤・空き枠情報をリアルタイムで配信中！
                    </p>
                    <a
                      href={store.xUrl || 'https://x.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={
                        isCyberTheme
                          ? 'inline-block px-6 py-2.5 font-bold text-xs tracking-widest text-white rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8]'
                          : isLuxuryTheme
                          ? 'inline-block px-6 py-2.5 font-medium text-xs tracking-[0.18em] rounded-full luxury-outline-btn'
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
          <section key="concept" className={`relative overflow-hidden text-center ${isCyberTheme ? 'py-16' : isLuxuryTheme ? 'py-20 sm:py-28 luxury-pink-bg border-b border-[#c695a2]/25' : 'py-16 bg-white'}`}>
            {isCyberTheme && (
              <>
                <div className="neon-orb neon-orb-pink animate-orb-slower w-[24rem] h-[24rem] top-10 -left-32" />
                <div className="neon-orb neon-orb-purple animate-orb-slow w-[22rem] h-[22rem] -bottom-32 right-0" />
              </>
            )}
            {isLuxuryTheme && (
              <>
                <div className="luxury-orb luxury-orb-rose w-[26rem] h-[26rem] top-10 -left-28 animate-orb-slow" />
                <div className="luxury-orb luxury-orb-gold w-[24rem] h-[24rem] -bottom-24 right-0 animate-orb-slower" />
              </>
            )}
            <div className="relative z-10 max-w-4xl mx-auto px-4">
              <SectionHeading title="Concept" subtitle="当店のこだわり" isCyber={isCyberTheme} isLuxury={isLuxuryTheme} className={isLuxuryTheme ? 'mb-12' : 'mb-8'} />

              <div className={`p-6 sm:p-10 text-xs sm:text-sm leading-loose tracking-wider text-left space-y-4 ${
                isCyberTheme
                  ? 'cyber-card reveal text-[#f4eefa]'
                  : isLuxuryTheme
                  ? 'luxury-card luxury-card-static !rounded-2xl sm:!rounded-3xl text-[#4a3e3d] luxury-body sm:p-14'
                  : 'bg-[#faf9f5] border border-[#d1b464]/30 rounded-sm text-stone-700'
              }`}>
                <p className={`text-center mb-2 ${
                  isCyberTheme ? 'font-bold neon-text-pink font-cyber-display text-base' : isLuxuryTheme ? 'font-luxury-display font-medium text-lg text-[#2b2827] tracking-[0.16em] leading-loose' : 'font-bold text-base text-stone-900'
                }`}>
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
                    <p className={`text-center font-medium pt-2 ${isCyberTheme ? 'text-[#ffa8d8]' : isLuxuryTheme ? 'text-[#c5a059]' : 'text-[#a39573]'}`}>
                      {isCyberTheme ? '非日常の最高級空間で、特別な密着タイムをお過ごしください。' : '赤羽・川口で特別な時間を、ぜひ当店でご体感ください。'}
                    </p>
                  </>
                )}
              </div>

              {isLuxuryTheme && (
                <div className="mt-16 sm:mt-24 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center text-left luxury-body rounded-2xl sm:rounded-3xl border border-[#e2b3b1]/35 bg-[#fdf8f5] shadow-[0_10px_30px_rgba(226,179,177,0.12)] px-6 py-12 sm:px-12 sm:py-16">
                  <div>
                    <p className="font-luxury-display italic text-lg sm:text-xl text-[#c5a059] mb-2 tracking-wider">Online Reservation</p>
                    <h3 className="font-luxury-display font-medium text-xl sm:text-2xl text-[#2b2827] tracking-[0.16em] mb-5">
                      24時間WEB予約
                    </h3>
                    <div className="luxury-gold-rule w-16 mb-6" />
                    <p className="text-xs sm:text-sm text-[#5c5250] leading-loose">
                      ご希望の日時・セラピストを選んで、いつでもオンラインでご予約いただけます。
                      お電話でのご予約も承っております。
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: '受付時間', value: store.businessHours },
                      { label: 'お電話でのご予約', value: store.phoneNumber, href: `tel:${store.phoneNumber}` },
                      { label: 'ご指名セラピスト', value: '予約フォームでお選びいただけます' },
                    ].map((row) => (
                      <div key={row.label} className="luxury-field px-4 py-3">
                        <div className="text-[10px] tracking-[0.2em] text-[#c5a059] mb-1 font-medium">{row.label}</div>
                        {row.href ? (
                          <a href={row.href} className="text-xs sm:text-sm text-[#2b2827] hover:text-[#c5a059] transition-colors">
                            {row.value}
                          </a>
                        ) : (
                          <div className="text-xs sm:text-sm text-[#2b2827]">{row.value}</div>
                        )}
                      </div>
                    ))}

                    <Link href={`/reserve/${shopSlug}`} className={`${luxuryPrimaryBtn} block w-full text-center !mt-6`}>
                      ONLINE RESERVATION
                    </Link>
                  </div>
                </div>
              )}
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
      <div className={`min-h-screen flex flex-col selection:bg-[#ff6fb5] selection:text-white ${
        isCyberTheme
          ? 'cyber-bg text-[#f4eefa] relative'
          : isLuxuryTheme
          ? 'luxury-marble-bg luxury-body'
          : 'bg-[#faf9f5] text-stone-800 font-serif'
      }`}>
        {isCyberTheme && <CyberParallaxBackground />}
        <Header store={store} />

        <main className="flex-1 relative z-10">
          {uniqueSections.map((sec) => renderSection(sec))}

          {/* 広告バナー（エステラブ等の相互リンク）。外部サイトの静的バナー画像なので
              next/imageは使わず素のimgで表示する（最適化APIの対象外ドメインのため）。 */}
          {store.adBanners && store.adBanners.length > 0 && (
            <section className={`relative py-8 border-t ${
              isCyberTheme ? 'border-[#ff6fb5]/20' : isLuxuryTheme ? 'border-[#e2b3b1]/30' : 'border-stone-200'
            }`}>
              <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 items-center justify-items-center">
                {store.adBanners.map((banner, idx) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={idx} href={banner.linkUrl} target="_blank" rel="noopener noreferrer nofollow sponsored">
                    <img src={banner.imageUrl} alt={banner.alt} width={200} height={40} className="max-w-full h-auto" />
                  </a>
                ))}
              </div>
            </section>
          )}
        </main>

        <Footer store={store} />
        <MobileFloatingBar store={store} />
      </div>
    </ThemeProvider>
  );
}
