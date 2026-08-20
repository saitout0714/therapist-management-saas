import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { headers } from 'next/headers';
import { Header } from '../../../../components/store/Header';
import { PageHeading } from '../../../../components/store/SectionHeading';
import { Footer } from '../../../../components/store/Footer';
import { ThemeProvider } from '../../../../components/store/ThemeProvider';
import { fetchStoreConfig, fetchNewsListPage } from '../../../../lib/storeApi';
import { publicBasePath } from '../../../../lib/shopDomains';

import { CyberParallaxBackground } from '../../../../components/store/CyberParallaxBackground';
import { LuxuryAmbientBackground } from '../../../../components/store/LuxuryAmbientBackground';

const PAGE_SIZE = 10;

/** サーバーコンポーネント。ニュース一覧をページングしてHTMLに載せる（TOPページの直近5件からの導線先、SEO用のアーカイブ）。 */
export default async function NewsListPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const resolvedParams = await params;
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const resolvedSearchParams = await searchParams;
  const page = Math.max(1, Number(resolvedSearchParams.page) || 1);

  const host = (await headers()).get('host');
  const basePath = publicBasePath(host, shopSlug);
  const storeConfig = await fetchStoreConfig(shopSlug);
  const store = { ...storeConfig, basePath };

  const { items: news, total } = await fetchNewsListPage(store.id, page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const isCyberTheme = shopSlug === 'onyankospa';
  const isLuxuryTheme = shopSlug === 'specialgrade';

  return (
    <ThemeProvider store={store}>
      <div className={`min-h-screen flex flex-col relative ${
        isCyberTheme ? 'cyber-bg text-[#f4eefa]' : isLuxuryTheme ? 'luxury-marble-bg luxury-body' : 'bg-[#faf9f5] text-stone-800 font-serif'
      }`}>
        {isCyberTheme && <CyberParallaxBackground variant="medium" />}
        {isLuxuryTheme && <LuxuryAmbientBackground />}
        <Header store={store} />

        <main className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full relative z-10">
          <PageHeading title="Topics" subtitle="新着情報 一覧" isCyber={isCyberTheme} isLuxury={isLuxuryTheme} className="mb-8" />

          {news.length === 0 ? (
            <div className={`p-6 text-center ${
              isCyberTheme
                ? 'cyber-card reveal rounded-xl border-[#ff6fb5]/40 font-sans'
                : isLuxuryTheme
                ? 'luxury-card rounded-2xl border border-[#e2b3b1]/35 luxury-body'
                : 'bg-white rounded-sm border border-[#d1b464]/30 font-serif shadow-sm'
            }`}>
              <p className={`text-xs ${isCyberTheme ? 'text-[#ded1ee]/60' : isLuxuryTheme ? 'text-[#8a7e7c]' : 'text-stone-400'}`}>現在お知らせはありません。</p>
            </div>
          ) : (
            <div className={`p-5 sm:p-7 divide-y ${
              isCyberTheme
                ? 'cyber-card reveal rounded-xl border-[#ff6fb5]/40 divide-[#ff6fb5]/20 font-sans'
                : isLuxuryTheme
                ? 'luxury-card rounded-2xl sm:rounded-3xl border border-[#e2b3b1]/35 divide-[#e2b3b1]/25 luxury-body'
                : 'bg-white rounded-sm border border-[#d1b464]/30 divide-stone-100 font-serif shadow-sm'
            }`}>
              {news.map((item) => (
                <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex gap-4">
                  {item.imageUrl && (
                    <Link href={`${basePath}/news/${item.id}`} className="shrink-0">
                      <div className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border ${
                        isCyberTheme ? 'border-[#ff6fb5]/30' : isLuxuryTheme ? 'border-[#e2b3b1]/40' : 'border-[#d1b464]/20'
                      }`}>
                        <Image src={item.imageUrl} alt={item.title} fill sizes="96px" className="object-cover" />
                      </div>
                    </Link>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className={`text-[10px] font-medium px-2.5 py-0.5 border ${
                        isCyberTheme
                          ? 'bg-[#ff6fb5]/20 text-[#ffa8d8] border-[#ff6fb5]/40 rounded-full font-bold'
                          : isLuxuryTheme
                          ? 'bg-[#fdf8f5] text-[#c5a059] border-[#e2b3b1]/50 rounded-full font-luxury-display'
                          : 'bg-[#faf7f0] text-[#a39573] border-[#d1b464]/30 rounded-sm font-bold'
                      }`}>
                        {item.category || 'お知らせ'}
                      </span>
                      <span className={`text-[11px] ${isCyberTheme ? 'text-[#ffa8d8]' : isLuxuryTheme ? 'text-[#8a7e7c]' : 'text-stone-400'}`}>{item.date}</span>
                    </div>
                    <h2 className={`text-sm font-semibold mb-1 ${isCyberTheme ? 'neon-text-pink' : isLuxuryTheme ? 'text-[#2b2827]' : 'text-stone-800'}`}>
                      <Link href={`${basePath}/news/${item.id}`} className="hover:underline">
                        {item.title}
                      </Link>
                    </h2>
                    <p className={`text-xs leading-relaxed line-clamp-2 ${isCyberTheme ? 'text-[#ded1ee]' : isLuxuryTheme ? 'text-[#5c5250]' : 'text-stone-600'}`}>{item.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-10 text-xs font-medium tracking-widest">
              {page > 1 ? (
                <Link href={`${basePath}/news?page=${page - 1}`} className={isLuxuryTheme ? 'luxury-outline-btn px-5 py-2 rounded-full' : 'px-5 py-2 rounded-sm border border-[#d1b464]/40 hover:bg-[#faf7f0]'}>
                  ← 前へ
                </Link>
              ) : (
                <span className="px-5 py-2 opacity-30">← 前へ</span>
              )}
              <span className={isCyberTheme ? 'text-[#ffa8d8]' : isLuxuryTheme ? 'text-[#8a7e7c]' : 'text-stone-500'}>
                {page} / {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={`${basePath}/news?page=${page + 1}`} className={isLuxuryTheme ? 'luxury-outline-btn px-5 py-2 rounded-full' : 'px-5 py-2 rounded-sm border border-[#d1b464]/40 hover:bg-[#faf7f0]'}>
                  次へ →
                </Link>
              ) : (
                <span className="px-5 py-2 opacity-30">次へ →</span>
              )}
            </div>
          )}
        </main>

        <Footer store={store} />
      </div>
    </ThemeProvider>
  );
}
