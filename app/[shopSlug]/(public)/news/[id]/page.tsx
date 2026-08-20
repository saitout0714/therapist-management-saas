import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Header } from '../../../../../components/store/Header';
import { Footer } from '../../../../../components/store/Footer';
import { ThemeProvider } from '../../../../../components/store/ThemeProvider';
import { LuxuryAmbientBackground } from '../../../../../components/store/LuxuryAmbientBackground';
import { fetchStoreConfig, fetchNewsDetail } from '../../../../../lib/storeApi';
import { publicBasePath } from '../../../../../lib/shopDomains';

/** サーバーコンポーネント。記事本文をHTMLに載せ、記事ごとに固有のURL・metadataを持たせる（SEO用）。 */
export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ shopSlug: string; id: string }>;
}) {
  const resolvedParams = await params;
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const newsId = resolvedParams.id;

  const host = (await headers()).get('host');
  const basePath = publicBasePath(host, shopSlug);
  const storeConfig = await fetchStoreConfig(shopSlug);
  const store = { ...storeConfig, basePath };

  const article = await fetchNewsDetail(store.id, newsId);
  if (!article) notFound();

  const isCyberTheme = shopSlug === 'onyankospa';
  const isLuxuryTheme = shopSlug === 'specialgrade';

  return (
    <ThemeProvider store={store}>
      <div className={`min-h-screen flex flex-col relative ${
        isCyberTheme ? 'cyber-bg text-[#f4eefa]' : isLuxuryTheme ? 'luxury-marble-bg luxury-body' : 'bg-[#faf9f5] text-stone-800 font-serif'
      }`}>
        {isLuxuryTheme && <LuxuryAmbientBackground />}
        <Header store={store} />

        <main className="flex-1 max-w-3xl mx-auto px-4 py-12 w-full relative z-10">
          <article className={`p-6 sm:p-10 space-y-6 ${
            isCyberTheme
              ? 'cyber-card reveal rounded-xl border-[#ff6fb5]/40'
              : isLuxuryTheme
              ? 'luxury-card rounded-2xl sm:rounded-3xl border border-[#e2b3b1]/35 shadow-[0_10px_30px_rgba(226,179,177,0.08)]'
              : 'bg-white rounded-sm border border-[#d1b464]/30 shadow-sm'
          }`}>
            <div className={`border-b pb-6 space-y-3 ${isCyberTheme ? 'border-[#ff6fb5]/20' : isLuxuryTheme ? 'border-[#e2b3b1]/25' : 'border-stone-200'}`}>
              <div className="flex items-center gap-3 text-xs">
                <span className={`font-medium px-2.5 py-0.5 border ${
                  isCyberTheme
                    ? 'bg-[#ff6fb5]/20 text-[#ffa8d8] border-[#ff6fb5]/40 rounded-full font-bold'
                    : isLuxuryTheme
                    ? 'bg-[#fdf8f5] text-[#c5a059] border-[#e2b3b1]/50 rounded-full font-luxury-display'
                    : 'bg-[#faf7f0] text-[#a39573] border-[#d1b464]/30 rounded-sm font-bold'
                }`}>
                  {article.category || 'お知らせ'}
                </span>
                <span className={isCyberTheme ? 'text-[#ffa8d8]' : isLuxuryTheme ? 'text-[#8a7e7c]' : 'text-stone-400'}>{article.date}</span>
              </div>

              <h1 className={`text-lg sm:text-2xl font-bold leading-tight tracking-wide ${isCyberTheme ? 'neon-text-pink' : isLuxuryTheme ? 'text-[#2b2827] font-luxury-display' : 'text-stone-800'}`}>
                {article.title}
              </h1>
            </div>

            {article.imageUrl && (
              <div className={`relative w-full h-64 sm:h-96 rounded-xl overflow-hidden border ${
                isCyberTheme ? 'border-[#ff6fb5]/30' : isLuxuryTheme ? 'border-[#e2b3b1]/40' : 'border-stone-200'
              }`}>
                <Image
                  src={article.imageUrl}
                  alt={article.title}
                  fill
                  sizes="(min-width: 640px) 640px, 100vw"
                  className="object-cover"
                />
              </div>
            )}

            <div className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line tracking-wide ${isCyberTheme ? 'text-[#ded1ee]' : isLuxuryTheme ? 'text-[#5c5250]' : 'text-stone-700'}`}>
              {article.content}
            </div>

            <div className={`border-t pt-6 flex flex-col sm:flex-row gap-4 justify-between items-center ${isCyberTheme ? 'border-[#ff6fb5]/20' : isLuxuryTheme ? 'border-[#e2b3b1]/25' : 'border-stone-200'}`}>
              <Link href={`${basePath}/news`} className={`text-xs font-semibold ${isCyberTheme ? 'text-[#ffa8d8]' : isLuxuryTheme ? 'text-[#8a7e7c] hover:text-[#c5a059]' : 'text-stone-500 hover:text-[#a39573]'}`}>
                ← 新着情報一覧へ戻る
              </Link>

              <Link
                href={`/reserve/${shopSlug}`}
                className={
                  isCyberTheme
                    ? 'w-full sm:w-auto px-6 py-3 font-bold text-xs rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8] text-white text-center tracking-widest'
                    : isLuxuryTheme
                    ? 'w-full sm:w-auto px-6 py-3 luxury-gold-btn text-white font-medium text-xs rounded-full text-center tracking-[0.18em]'
                    : 'w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-[#d1b464] to-[#a39573] text-white font-bold text-xs rounded-sm shadow-md text-center hover:brightness-105 transition-all tracking-widest'
                }
              >
                24時間WEB予約はこちら
              </Link>
            </div>
          </article>
        </main>

        <Footer store={store} />
      </div>
    </ThemeProvider>
  );
}
