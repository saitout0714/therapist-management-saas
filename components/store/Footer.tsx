import React from 'react';
import Link from 'next/link';
import { StoreConfig } from '../../types/store';
import { DIARY_FEATURE_ENABLED } from '../../lib/featureFlags';

interface FooterProps {
  store: StoreConfig;
}

export const Footer: React.FC<FooterProps> = ({ store }) => {
  const basePath = `/${store.slug}`;
  const reservePath = `/reserve/${store.slug}`;
  const primaryColor = store.themeColor?.primary || '#d1b464';
  const accentColor = store.themeColor?.accent || '#a39573';
  const isCyberTheme = store.slug === 'onyankospa';

  return (
    <footer className={`border-t pt-12 pb-8 backdrop-blur-xl ${
      isCyberTheme
        ? 'bg-[#0d0914]/85 text-[#ded1ee] border-[#ff6fb5]/35 shadow-[0_-6px_28px_rgba(255,111,181,0.2)]'
        : 'bg-[#1f1d1a] text-stone-300 border-[#d1b464]/30 font-serif'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* 店舗情報 */}
          <div>
            <h3 className={`text-xl font-bold mb-3 tracking-wider ${isCyberTheme ? 'neon-text-pink' : ''}`} style={{ color: isCyberTheme ? undefined : primaryColor }}>
              {store.name}
            </h3>
            <p className={`text-xs mb-4 tracking-widest ${isCyberTheme ? 'text-[#ffa8d8]' : 'text-stone-400'}`}>{store.catchphrase}</p>
            <div className="space-y-2 text-xs">
              <p><span style={{ color: isCyberTheme ? '#ffa8d8' : accentColor }}>住所：</span>{store.address}</p>
              <p><span style={{ color: isCyberTheme ? '#ffa8d8' : accentColor }}>アクセス：</span>{store.accessInfo}</p>
              <p><span style={{ color: isCyberTheme ? '#ffa8d8' : accentColor }}>営業時間：</span>{store.businessHours}</p>
              <p><span style={{ color: isCyberTheme ? '#ffa8d8' : accentColor }}>電話番号：</span>{store.phoneNumber}</p>
            </div>
          </div>

          {/* クイックリンク */}
          <div className="space-y-2 text-xs">
            <h4 className={`text-sm font-semibold mb-3 border-b pb-1 inline-block tracking-widest ${
              isCyberTheme ? 'neon-text-pink border-[#ff6fb5]/40' : 'border-[#d1b464]/30'
            }`} style={{ color: isCyberTheme ? undefined : primaryColor }}>
              CONTENTS
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <Link href={basePath} className="hover:opacity-80 transition-colors">TOP</Link>
              <Link href={`${basePath}/system`} className="hover:opacity-80 transition-colors">システム・料金</Link>
              <Link href={`${basePath}/therapists`} className="hover:opacity-80 transition-colors">セラピスト一覧</Link>
              <Link href={`${basePath}/schedule`} className="hover:opacity-80 transition-colors">出勤スケジュール</Link>
              {DIARY_FEATURE_ENABLED && (
                <Link href={`${basePath}/diary`} className="hover:opacity-80 transition-colors">セラピスト日記</Link>
              )}
              <Link href={`${basePath}/access`} className="hover:opacity-80 transition-colors">アクセス</Link>
              <Link href={`${basePath}/recruit`} className="hover:opacity-80 transition-colors">求人情報</Link>
              <Link href={reservePath} className="hover:opacity-80 transition-colors">WEB予約</Link>
            </div>
          </div>

          {/* SNS & お問い合わせ & Google Maps */}
          <div>
            <h4 className={`text-sm font-semibold mb-3 border-b pb-1 inline-block tracking-widest ${
              isCyberTheme ? 'neon-text-pink border-[#ff6fb5]/40' : 'border-[#d1b464]/30'
            }`} style={{ color: isCyberTheme ? undefined : primaryColor }}>
              CONTACT & ACCESS
            </h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {store.xUrl && (
                <a
                  href={store.xUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-3.5 py-1.5 border text-[11px] rounded transition-colors ${
                    isCyberTheme
                      ? 'bg-white/10 border-[#ff6fb5]/40 text-[#ded1ee] hover:border-[#ff6fb5] hover:text-[#ffa8d8] hover:shadow-[0_0_12px_rgba(255,111,181,0.3)]'
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
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 border text-[11px] rounded transition-colors ${
                    isCyberTheme
                      ? 'bg-white/10 border-[#ff6fb5]/40 text-[#ded1ee] hover:border-[#ff6fb5] hover:text-[#ffa8d8] hover:shadow-[0_0_12px_rgba(255,111,181,0.3)]'
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
                  className={`px-3.5 py-1.5 border text-[11px] rounded transition-colors ${
                    isCyberTheme
                      ? 'bg-white/10 border-[#ff6fb5]/40 text-[#ded1ee] hover:border-[#ff6fb5] hover:text-[#ffa8d8] hover:shadow-[0_0_12px_rgba(255,111,181,0.3)]'
                      : 'bg-stone-900 border-[#d1b464]/40 hover:border-[#d1b464] text-stone-200'
                  }`}
                >
                  📍 Google Maps
                </a>
              )}
            </div>
            <Link
              href={reservePath}
              className={`inline-block w-full py-3 text-center text-white font-bold text-xs tracking-widest shadow-md transition-all ${
                isCyberTheme
                  ? 'rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8]'
                  : 'bg-gradient-to-r from-[#d1b464] to-[#a39573] rounded-sm hover:brightness-105'
              }`}
            >
              24時間 WEB予約 🐾
            </Link>
          </div>
        </div>

        <div className={`border-t pt-6 text-center text-[11px] tracking-widest ${
          isCyberTheme ? 'border-[#ff6fb5]/20 text-[#ffa8d8]' : 'border-stone-800 text-stone-500'
        }`}>
          © {new Date().getFullYear()} {store.name}. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
};
