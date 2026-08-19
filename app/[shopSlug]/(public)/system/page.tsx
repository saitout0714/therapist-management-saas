import React from 'react';
import { headers } from 'next/headers';
import { Header } from '../../../../components/store/Header';
import { PageHeading } from '../../../../components/store/SectionHeading';
import { Footer } from '../../../../components/store/Footer';
import { ThemeProvider } from '../../../../components/store/ThemeProvider';
import { fetchStoreConfig, fetchSystemCourses, fetchSystemExtras } from '../../../../lib/storeApi';
import { SystemMenuCategory } from '../../../../types/store';
import { publicBasePath } from '../../../../lib/shopDomains';

import { CyberParallaxBackground } from '../../../../components/store/CyberParallaxBackground';

/**
 * サーバーコンポーネント。コース・料金表をHTMLに載せるため取得をサーバー側に移している。
 * データが揃った状態で描画されるので、読み込み中スピナーは不要になった。
 */
export default async function SystemPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = await params;
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';

  const host = (await headers()).get('host');
  const basePath = publicBasePath(host, shopSlug);
  const store = { ...(await fetchStoreConfig(shopSlug)), basePath };
  const [cList, extras] = await Promise.all([
    fetchSystemCourses(store.id),
    fetchSystemExtras(store.id),
  ]);
  const categories: SystemMenuCategory[] = [...cList, ...extras];

  const isCyberTheme = shopSlug === 'onyankospa';
  const isLuxuryTheme = shopSlug === 'specialgrade';

  /*
   * オプションは複数を組み合わせられるため、単体金額は「〜」の目安表示にする。
   * 指名料金のうち「本指名」はセラピストごとに個別設定できる（therapist_pricing.nomination_fee）ため
   * 同様に「〜」表示にし、フリー・写真指名など固定額の項目はそのまま表示する。
   */
  const isStartingPrice = (cat: SystemMenuCategory, course: SystemMenuCategory['courses'][number]) =>
    cat.categoryName === 'オプション' || course.name === '本指名';

  return (
    <ThemeProvider store={store}>
      <div className={`min-h-screen flex flex-col relative ${
        isCyberTheme ? 'cyber-bg text-[#f4eefa]' : isLuxuryTheme ? 'luxury-marble-bg luxury-body' : 'bg-[#faf9f5] text-stone-800 font-serif'
      }`}>
        {isCyberTheme && <CyberParallaxBackground variant="medium" pageType="system" />}
        <Header store={store} />

        <main className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full relative z-10">
        <PageHeading title="System" subtitle="システム・料金案内" isCyber={isCyberTheme} isLuxury={isLuxuryTheme} className="mb-10" />

          <p className={`text-[11px] mb-6 tracking-wide text-center ${isCyberTheme ? 'text-[#ded1ee]/80' : isLuxuryTheme ? 'text-[#a8a196]' : 'text-stone-500'}`}>
            ※料金は全て税込表記になります。コース時間にはお着替えやシャワーなどの時間も含まれます。
          </p>

          <div className="space-y-8">
            {categories.map((cat, idx) => (
            <div
              key={idx}
              className={`p-6 space-y-4 ${
                isCyberTheme
                  ? 'cyber-card reveal rounded-xl border-[#ff6fb5]/40'
                  : isLuxuryTheme
                  ? 'luxury-card luxury-gold-border rounded-lg'
                  : 'bg-white rounded-sm border border-[#d1b464]/30 shadow-sm'
              }`}
            >
              <h2 className={`text-base font-bold border-b pb-2 tracking-wider ${
                isCyberTheme ? 'neon-text-pink border-[#ff6fb5]/30' : isLuxuryTheme ? 'font-luxury-display text-[#a8874a] border-[#e9dcc4]' : 'text-[#a39573] border-stone-200'
              }`}>
                {isLuxuryTheme ? cat.categoryName : `🐾 ${cat.categoryName}`}
              </h2>
              {cat.description && (
                <p className={`text-xs tracking-wide ${isCyberTheme ? 'text-[#ded1ee]' : isLuxuryTheme ? 'text-[#6b6459]' : 'text-stone-600'}`}>
                  {cat.description}
                </p>
              )}

              <div className="space-y-3">
                {cat.courses.map((course) => (
                  <div
                    key={course.id}
                    className={`flex flex-row items-center justify-between p-4 border gap-3 transition-colors ${
                      isCyberTheme
                        ? 'bg-white/10 border-[#ff6fb5]/30 hover:border-[#ff6fb5] rounded-xl'
                        : isLuxuryTheme
                        ? 'bg-[#f1e9db]/50 border-[#e9dcc4] hover:border-[#c9a869] rounded-lg'
                        : 'bg-[#faf7f0] border-[#d1b464]/20 hover:border-[#d1b464] rounded-sm'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-bold text-sm sm:text-base tracking-wider ${
                          isCyberTheme ? 'text-[#f4eefa]' : isLuxuryTheme ? 'text-[#2b2b2b]' : 'text-stone-800'
                        }`}>
                          {course.name}
                        </h3>
                        {course.durationMinutes > 0 && (
                          <span className={`text-[11px] font-bold px-2 py-0.5 border ${
                            isCyberTheme
                              ? 'bg-[#ff6fb5]/20 text-[#ffa8d8] border-[#ff6fb5]/50 rounded-full'
                              : isLuxuryTheme
                              ? 'bg-white text-[#a8874a] border-[#c9a869]/40 rounded-full'
                              : 'bg-[#d1b464]/20 text-[#a39573] border-[#d1b464]/40 rounded-sm'
                          }`}>
                            {course.durationMinutes}分
                          </span>
                        )}
                      </div>
                      {course.description && (
                        <p className={`text-xs leading-relaxed tracking-wide ${
                          isCyberTheme ? 'text-[#ded1ee]/90' : isLuxuryTheme ? 'text-[#6b6459]' : 'text-stone-600'
                        }`}>
                          {course.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-lg sm:text-xl font-extrabold tracking-wider ${
                        isCyberTheme ? 'neon-text-pink' : isLuxuryTheme ? 'font-luxury-display text-[#a8874a]' : 'text-stone-900'
                      }`}>
                        ¥{course.price.toLocaleString()}{isStartingPrice(cat, course) ? '〜' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {store.termsOfService && (
          <div className={`mt-12 p-6 space-y-3 ${
            isCyberTheme
              ? 'cyber-card rounded-xl border-[#ff6fb5]/40'
              : isLuxuryTheme
              ? 'luxury-card luxury-gold-border rounded-lg'
              : 'bg-white rounded-sm border border-[#d1b464]/30 shadow-sm'
          }`}>
            <h2 className={`text-base font-bold border-b pb-2 tracking-wider ${
              isCyberTheme ? 'neon-text-pink border-[#ff6fb5]/30' : isLuxuryTheme ? 'font-luxury-display text-[#a8874a] border-[#e9dcc4]' : 'text-[#a39573] border-stone-200'
            }`}>
              利用規約・禁止事項
            </h2>
            <p className={`text-xs leading-relaxed tracking-wide whitespace-pre-wrap ${
              isCyberTheme ? 'text-[#ded1ee]/90' : isLuxuryTheme ? 'text-[#6b6459]' : 'text-stone-600'
            }`}>
              {store.termsOfService}
            </p>
          </div>
        )}
      </main>

      <Footer store={store} />
    </div>
    </ThemeProvider>
  );
}

