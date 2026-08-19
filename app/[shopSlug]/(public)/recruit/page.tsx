import React from 'react';
import { headers } from 'next/headers';
import { Header } from '../../../../components/store/Header';
import { PageHeading } from '../../../../components/store/SectionHeading';
import { Footer } from '../../../../components/store/Footer';
import { fetchStoreConfig } from '../../../../lib/storeApi';
import { publicBasePath } from '../../../../lib/shopDomains';

import { CyberParallaxBackground } from '../../../../components/store/CyberParallaxBackground';

/** サーバーコンポーネント。求人内容をHTMLに載せるため取得をサーバー側に移している。 */
export default async function RecruitPage({ params }: { params: Promise<{ shopSlug: string }> }) {
  const resolvedParams = await params;
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';

  const host = (await headers()).get('host');
  const basePath = publicBasePath(host, shopSlug);
  const store = { ...(await fetchStoreConfig(shopSlug)), basePath };

  const isCyberTheme = shopSlug === 'onyankospa';
  const isLuxuryTheme = shopSlug === 'specialgrade';

  const rInfo = store.recruitInfo;
  const title = rInfo?.title || 'セラピスト求人募集';
  const catchphrase = rInfo?.catchphrase || '🐾 地域最高水準のバック率 ＆ 全額日払い対応 🐾';
  const description = rInfo?.description || 'ノルマ・ペナルティ一切なし！アットホームで快適な完全個室マンションルーム完備。';
  const jobType = rInfo?.jobType || 'アロマセラピスト・トリートメント施術';
  const qualification = rInfo?.qualification || '18歳以上（高校生不可）、未経験者大歓迎！';
  const salary = rInfo?.salary || '日給 30,000円 ～ 80,000円可能（全額日払いOK）';
  const hours = rInfo?.hours || '12:00 ～ 翌5:00 (週1日・3時間～OKの自由シフト制)';
  const notes = rInfo?.notes;

  return (
    <div className={`min-h-screen flex flex-col relative ${
      isCyberTheme ? 'cyber-bg text-[#f4eefa]' : isLuxuryTheme ? 'luxury-marble-bg luxury-body' : 'bg-[#faf9f5] text-stone-800 font-serif'
    }`}>
      {isCyberTheme && <CyberParallaxBackground variant="medium" pageType="recruit" />}
      <Header store={store} />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-12 w-full relative z-10">
        <div className="mb-8 space-y-3">
          <PageHeading title="Recruit" subtitle={title} isCyber={isCyberTheme} isLuxury={isLuxuryTheme} />
          <p className={`text-center text-xs tracking-widest ${isCyberTheme ? 'text-[#ffa8d8]' : isLuxuryTheme ? 'text-[#c5a059]' : 'text-[#a39573]'}`}>
            高収入・最高環境で一緒に働きませんか？未経験歓迎！
          </p>
        </div>

        <div className={`p-6 sm:p-8 space-y-6 ${
          isCyberTheme
            ? 'cyber-card reveal rounded-xl border-[#ff6fb5]/40'
            : isLuxuryTheme
            ? 'luxury-card rounded-2xl sm:rounded-3xl border border-[#e2b3b1]/35 shadow-[0_10px_30px_rgba(226,179,177,0.08)]'
            : 'bg-white rounded-sm border border-[#d1b464]/30 shadow-sm'
        }`}>
          <div className={`p-6 rounded-2xl border text-center space-y-2 ${
            isCyberTheme
              ? 'bg-white/10 border-[#ff6fb5]/40'
              : isLuxuryTheme
              ? 'bg-[#fdf8f5] border-[#e2b3b1]/35'
              : 'bg-[#faf7f0] border-[#d1b464]/30'
          }`}>
            <h2 className={`text-base font-bold tracking-wider ${
              isCyberTheme ? 'neon-text-pink' : isLuxuryTheme ? 'font-luxury-display italic text-[#c5a059] text-lg' : 'text-[#a39573]'
            }`}>
              {catchphrase}
            </h2>
            <p className={`text-xs leading-relaxed ${isCyberTheme ? 'text-[#ded1ee]' : isLuxuryTheme ? 'text-[#5c5250]' : 'text-stone-600'}`}>
              {description}
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className={`grid grid-cols-1 sm:grid-cols-3 p-4 border ${
              isCyberTheme ? 'bg-white/8 border-[#ff6fb5]/30 rounded-xl' : isLuxuryTheme ? 'bg-[#fdf8f5] border-[#e2b3b1]/30 rounded-xl' : 'bg-[#faf7f0] border-[#d1b464]/20 rounded-sm'
            }`}>
              <span className={`font-bold ${isCyberTheme ? 'text-[#ffa8d8]' : isLuxuryTheme ? 'text-[#c5a059] font-medium' : 'text-stone-500'}`}>職種</span>
              <span className={`sm:col-span-2 font-semibold ${isCyberTheme ? 'text-[#f4eefa]' : isLuxuryTheme ? 'text-[#2b2827]' : 'text-stone-800'}`}>{jobType}</span>
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-3 p-4 border ${
              isCyberTheme ? 'bg-white/8 border-[#ff6fb5]/30 rounded-xl' : isLuxuryTheme ? 'bg-[#fdf8f5] border-[#e2b3b1]/30 rounded-xl' : 'bg-[#faf7f0] border-[#d1b464]/20 rounded-sm'
            }`}>
              <span className={`font-bold ${isCyberTheme ? 'text-[#ffa8d8]' : isLuxuryTheme ? 'text-[#c5a059] font-medium' : 'text-stone-500'}`}>資格</span>
              <span className={`sm:col-span-2 font-semibold ${isCyberTheme ? 'text-[#f4eefa]' : isLuxuryTheme ? 'text-[#2b2827]' : 'text-stone-800'}`}>{qualification}</span>
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-3 p-4 border ${
              isCyberTheme ? 'bg-white/8 border-[#ff6fb5]/30 rounded-xl' : isLuxuryTheme ? 'bg-[#fdf8f5] border-[#e2b3b1]/30 rounded-xl' : 'bg-[#faf7f0] border-[#d1b464]/20 rounded-sm'
            }`}>
              <span className={`font-bold ${isCyberTheme ? 'text-[#ffa8d8]' : isLuxuryTheme ? 'text-[#c5a059] font-medium' : 'text-stone-500'}`}>給与</span>
              <span className={`sm:col-span-2 font-semibold ${isCyberTheme ? 'text-[#f4eefa]' : isLuxuryTheme ? 'text-[#2b2827]' : 'text-stone-800'}`}>{salary}</span>
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-3 p-4 border ${
              isCyberTheme ? 'bg-white/8 border-[#ff6fb5]/30 rounded-xl' : isLuxuryTheme ? 'bg-[#fdf8f5] border-[#e2b3b1]/30 rounded-xl' : 'bg-[#faf7f0] border-[#d1b464]/20 rounded-sm'
            }`}>
              <span className={`font-bold ${isCyberTheme ? 'text-[#ffa8d8]' : isLuxuryTheme ? 'text-[#c5a059] font-medium' : 'text-stone-500'}`}>勤務時間</span>
              <span className={`sm:col-span-2 font-semibold ${isCyberTheme ? 'text-[#f4eefa]' : isLuxuryTheme ? 'text-[#2b2827]' : 'text-stone-800'}`}>{hours}</span>
            </div>
            {notes && (
              <div className={`grid grid-cols-1 sm:grid-cols-3 p-4 border ${
                isCyberTheme ? 'bg-white/8 border-[#ff6fb5]/30 rounded-xl' : isLuxuryTheme ? 'bg-[#fdf8f5] border-[#e2b3b1]/30 rounded-xl' : 'bg-[#faf7f0] border-[#d1b464]/20 rounded-sm'
              }`}>
                <span className={`font-bold ${isCyberTheme ? 'text-[#ffa8d8]' : isLuxuryTheme ? 'text-[#c5a059] font-medium' : 'text-stone-500'}`}>備考・アピール</span>
                <span className={`sm:col-span-2 font-semibold ${isCyberTheme ? 'text-[#f4eefa]' : isLuxuryTheme ? 'text-[#2b2827]' : 'text-stone-800'}`}>{notes}</span>
              </div>
            )}
          </div>

          <div className={`flex flex-row gap-3 pt-4 ${store.lineUrl ? '' : 'justify-center'}`}>
            <a
              href={`tel:${rInfo?.phone || store.phoneNumber}`}
              className={`${store.lineUrl ? 'w-1/2' : ''} inline-flex items-center justify-center px-4 sm:px-8 py-3.5 text-white font-medium text-xs shadow-md tracking-widest transition-all ${
                isCyberTheme
                  ? 'rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8] font-bold'
                  : isLuxuryTheme
                  ? 'rounded-full luxury-gold-btn'
                  : 'bg-gradient-to-r from-[#d1b464] to-[#a39573] rounded-sm hover:brightness-105 font-bold'
              }`}
            >
              📞 電話で応募
            </a>
            {store.lineUrl && (
              <a
                href={store.lineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-1/2 inline-flex items-center justify-center px-4 sm:px-8 py-3.5 text-white font-bold text-xs shadow-md tracking-widest transition-all ${
                  isCyberTheme || isLuxuryTheme ? 'rounded-full' : 'rounded-sm hover:brightness-105'
                } bg-[#06C755]`}
              >
                💬 LINEで応募
              </a>
            )}
          </div>
        </div>
      </main>

      <Footer store={store} />
    </div>
  );
}

