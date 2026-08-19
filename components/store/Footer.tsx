import React from 'react';
import Link from 'next/link';
import { StoreConfig } from '../../types/store';
import { DIARY_FEATURE_ENABLED } from '../../lib/featureFlags';
import { SpecialGradeLogo } from './SpecialGradeLogo';

interface FooterProps {
  store: StoreConfig;
}

export const Footer: React.FC<FooterProps> = ({ store }) => {
  const basePath = store.basePath ?? `/${store.slug}`;
  const reservePath = `/reserve/${store.slug}`;
  const primaryColor = store.themeColor?.primary || '#d1b464';
  const accentColor = store.themeColor?.accent || '#a39573';
  const isCyberTheme = store.slug === 'onyankospa';
  const isLuxuryTheme = store.slug === 'specialgrade';

  return (
    <footer className={`border-t backdrop-blur-xl ${
      isCyberTheme
        ? 'pt-12 pb-8 bg-[#0d0914]/85 text-[#ded1ee] border-[#ff6fb5]/35 shadow-[0_-6px_28px_rgba(255,111,181,0.2)]'
        : isLuxuryTheme
        ? 'pt-16 sm:pt-24 pb-12 luxury-footer-bg text-[#2b2827] border-t border-[#c695a2]/25 luxury-body shadow-[0_-8px_30px_rgba(198,149,162,0.1)]'
        : 'pt-12 pb-8 bg-[#1f1d1a] text-stone-300 border-[#d1b464]/30 font-serif'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 ${isLuxuryTheme ? 'mb-14' : 'mb-8'}`}>
          {/* 店舗情報 */}
          <div>
            {isLuxuryTheme ? (
              <div className="mb-4">
                <SpecialGradeLogo size="md" />
              </div>
            ) : (
              <h3
                className={`${isLuxuryTheme ? 'font-luxury-display text-2xl font-semibold tracking-[0.16em]' : 'text-xl font-bold tracking-wider'} mb-3 ${isCyberTheme ? 'neon-text-pink' : ''}`}
                style={{ color: isCyberTheme ? undefined : isLuxuryTheme ? '#2b2827' : primaryColor }}
              >
                {store.name}
              </h3>
            )}
            <p className={`text-xs mb-4 tracking-widest ${isCyberTheme ? 'text-[#ffa8d8]' : isLuxuryTheme ? 'text-[#8a7e7c]' : 'text-stone-400'}`}>{store.catchphrase}</p>
            <div className="space-y-2 text-xs leading-relaxed text-[#5c5250]">
              <p><span style={{ color: isCyberTheme ? '#ffa8d8' : isLuxuryTheme ? '#c5a059' : accentColor }} className="font-medium">住所：</span>{store.address}</p>
              <p><span style={{ color: isCyberTheme ? '#ffa8d8' : isLuxuryTheme ? '#c5a059' : accentColor }} className="font-medium">アクセス：</span>{store.accessInfo}</p>
              <p><span style={{ color: isCyberTheme ? '#ffa8d8' : isLuxuryTheme ? '#c5a059' : accentColor }} className="font-medium">営業時間：</span>{store.businessHours}</p>
              <p><span style={{ color: isCyberTheme ? '#ffa8d8' : isLuxuryTheme ? '#c5a059' : accentColor }} className="font-medium">電話番号：</span>{store.phoneNumber}</p>
            </div>
          </div>

          {/* クイックリンク */}
          <div className="space-y-2 text-xs">
            <h4
              className={`text-sm font-semibold mb-3 border-b pb-1 inline-block tracking-widest ${
                isCyberTheme ? 'neon-text-pink border-[#ff6fb5]/40' : isLuxuryTheme ? 'font-luxury-display italic tracking-[0.2em] border-[#e2b3b1]/40' : 'border-[#d1b464]/30'
              }`}
              style={{ color: isCyberTheme ? undefined : isLuxuryTheme ? '#c5a059' : primaryColor }}
            >
              CONTENTS
            </h4>
            <div className={`grid grid-cols-2 gap-2 ${isLuxuryTheme ? 'text-[#5c5250]' : ''}`}>
              <Link href={basePath || '/'} className="hover:opacity-80 transition-colors hover:text-[#c5a059]">TOP</Link>
              <Link href={`${basePath}/system`} className="hover:opacity-80 transition-colors hover:text-[#c5a059]">システム・料金</Link>
              <Link href={`${basePath}/therapists`} className="hover:opacity-80 transition-colors hover:text-[#c5a059]">セラピスト一覧</Link>
              <Link href={`${basePath}/schedule`} className="hover:opacity-80 transition-colors hover:text-[#c5a059]">出勤スケジュール</Link>
              {DIARY_FEATURE_ENABLED && (
                <Link href={`${basePath}/diary`} className="hover:opacity-80 transition-colors hover:text-[#c5a059]">セラピスト日記</Link>
              )}
              <Link href={`${basePath}/access`} className="hover:opacity-80 transition-colors hover:text-[#c5a059]">アクセス</Link>
              <Link href={`${basePath}/recruit`} className="hover:opacity-80 transition-colors hover:text-[#c5a059]">求人情報</Link>
              <Link href={reservePath} className="hover:opacity-80 transition-colors hover:text-[#c5a059]">WEB予約</Link>
            </div>
          </div>

          {/* SNS & お問い合わせ & Google Maps */}
          <div>
            <h4
              className={`text-sm font-semibold mb-3 border-b pb-1 inline-block tracking-widest ${
                isCyberTheme ? 'neon-text-pink border-[#ff6fb5]/40' : isLuxuryTheme ? 'font-luxury-display italic tracking-[0.2em] border-[#e2b3b1]/40' : 'border-[#d1b464]/30'
              }`}
              style={{ color: isCyberTheme ? undefined : isLuxuryTheme ? '#c5a059' : primaryColor }}
            >
              CONTACT & ACCESS
            </h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {store.xUrl && (
                <a
                  href={store.xUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-3.5 py-1.5 border text-[11px] rounded-full transition-colors ${
                    isCyberTheme
                      ? 'bg-white/10 border-[#ff6fb5]/40 text-[#ded1ee] hover:border-[#ff6fb5] hover:text-[#ffa8d8] hover:shadow-[0_0_12px_rgba(255,111,181,0.3)]'
                      : isLuxuryTheme
                      ? 'bg-white/80 border-[#e2b3b1]/45 hover:border-[#c5a059] hover:text-[#c5a059] hover:bg-white hover:shadow-[0_0_15px_rgba(226,179,177,0.3)] text-[#4a3e3d]'
                      : 'bg-stone-900 border-[#d1b464]/40 hover:border-[#d1b464] text-stone-200'
                  }`}
                >
                  X (Twitter)
                </a>
              )}
              {store.lineUrl && (
                <a
                  href={store.lineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 border text-[11px] rounded-full transition-colors ${
                    isCyberTheme
                      ? 'bg-white/10 border-[#ff6fb5]/40 text-[#ded1ee] hover:border-[#ff6fb5] hover:text-[#ffa8d8] hover:shadow-[0_0_12px_rgba(255,111,181,0.3)]'
                      : isLuxuryTheme
                      ? 'bg-white/80 border-[#e2b3b1]/45 hover:border-[#c5a059] hover:text-[#c5a059] hover:bg-white hover:shadow-[0_0_15px_rgba(226,179,177,0.3)] text-[#4a3e3d]'
                      : 'bg-stone-900 border-[#d1b464]/40 hover:border-[#d1b464] text-stone-200'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="#06C755">
                    <path d="M12 2C6.48 2 2 5.94 2 10.7c0 4.27 3.53 7.85 8.3 8.53.32.07.76.22.87.5.1.26.07.66.03.92l-.14.87c-.04.26-.2 1.01.88.55 1.08-.46 5.8-3.42 7.92-5.85C21.5 14.02 22 12.42 22 10.7 22 5.94 17.52 2 12 2z"/>
                  </svg>
                  公式LINE
                </a>
              )}
              {store.googleMapUrl && (
                <a
                  href={store.googleMapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-3.5 py-1.5 border text-[11px] rounded-full transition-colors ${
                    isCyberTheme
                      ? 'bg-white/10 border-[#ff6fb5]/40 text-[#ded1ee] hover:border-[#ff6fb5] hover:text-[#ffa8d8] hover:shadow-[0_0_12px_rgba(255,111,181,0.3)]'
                      : isLuxuryTheme
                      ? 'bg-white/80 border-[#e2b3b1]/45 hover:border-[#c5a059] hover:text-[#c5a059] hover:bg-white hover:shadow-[0_0_15px_rgba(226,179,177,0.3)] text-[#4a3e3d]'
                      : 'bg-stone-900 border-[#d1b464]/40 hover:border-[#d1b464] text-stone-200'
                  }`}
                >
                  📍 Google Maps
                </a>
              )}
            </div>
            <Link
              href={reservePath}
              className={`inline-block w-full py-3.5 text-center text-white text-xs tracking-widest transition-all ${
                isCyberTheme
                  ? 'font-bold shadow-md rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8]'
                  : isLuxuryTheme
                  ? 'font-medium tracking-[0.18em] shadow-md rounded-full luxury-gold-btn'
                  : 'font-bold shadow-md bg-gradient-to-r from-[#d1b464] to-[#a39573] rounded-sm hover:brightness-105'
              }`}
            >
              {isLuxuryTheme ? 'ONLINE RESERVATION' : '24時間 WEB予約 🐾'}
            </Link>
          </div>
        </div>

        <div className={`border-t pt-6 text-center text-[11px] tracking-widest ${
          isCyberTheme ? 'border-[#ff6fb5]/20 text-[#ffa8d8]' : isLuxuryTheme ? 'border-[#e2b3b1]/20 text-[#8a7e7c]' : 'border-stone-800 text-stone-500'
        }`}>
          © {new Date().getFullYear()} {store.name}. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
};
