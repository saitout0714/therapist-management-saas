import React from 'react';
import Link from 'next/link';
import { StoreConfig } from '../../types/store';

interface FooterProps {
  store: StoreConfig;
}

export const Footer: React.FC<FooterProps> = ({ store }) => {
  const basePath = `/${store.slug}`;
  const primaryColor = store.themeColor?.primary || '#d1b464';
  const accentColor = store.themeColor?.accent || '#a39573';
  const isCyberTheme = store.slug === 'onyankospa';

  return (
    <footer className={`border-t pt-12 pb-8 ${
      isCyberTheme
        ? 'bg-[#050014] text-pink-100 border-[#ff8fc9]/40 font-sans'
        : 'bg-[#1f1d1a] text-stone-300 border-[#d1b464]/30 font-serif'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* 店舗情報 */}
          <div>
            <h3 className={`text-xl font-bold mb-3 tracking-wider ${isCyberTheme ? 'neon-text-pink' : ''}`} style={{ color: isCyberTheme ? undefined : primaryColor }}>
              {store.name}
            </h3>
            <p className={`text-xs mb-4 tracking-widest ${isCyberTheme ? 'text-pink-300' : 'text-stone-400'}`}>{store.catchphrase}</p>
            <div className="space-y-2 text-xs">
              <p><span style={{ color: isCyberTheme ? '#ffb8e0' : accentColor }}>住所：</span>{store.address}</p>
              <p><span style={{ color: isCyberTheme ? '#ffb8e0' : accentColor }}>アクセス：</span>{store.accessInfo}</p>
              <p><span style={{ color: isCyberTheme ? '#ffb8e0' : accentColor }}>営業時間：</span>{store.businessHours}</p>
              <p><span style={{ color: isCyberTheme ? '#ffb8e0' : accentColor }}>電話番号：</span>{store.phoneNumber}</p>
            </div>
          </div>

          {/* クイックリンク */}
          <div className="space-y-2 text-xs">
            <h4 className={`text-sm font-semibold mb-3 border-b pb-1 inline-block tracking-widest ${
              isCyberTheme ? 'neon-text-pink border-[#ff8fc9]/40' : 'border-[#d1b464]/30'
            }`} style={{ color: isCyberTheme ? undefined : primaryColor }}>
              CONTENTS
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <Link href={basePath} className="hover:opacity-80 transition-colors">TOP</Link>
              <Link href={`${basePath}/system`} className="hover:opacity-80 transition-colors">システム・料金</Link>
              <Link href={`${basePath}/therapists`} className="hover:opacity-80 transition-colors">セラピスト一覧</Link>
              <Link href={`${basePath}/schedule`} className="hover:opacity-80 transition-colors">出勤スケジュール</Link>
              <Link href={`${basePath}/diary`} className="hover:opacity-80 transition-colors">セラピスト日記</Link>
              <Link href={`${basePath}/access`} className="hover:opacity-80 transition-colors">アクセス</Link>
              <Link href={`${basePath}/recruit`} className="hover:opacity-80 transition-colors">求人情報</Link>
              <Link href={`${basePath}/reserve`} className="hover:opacity-80 transition-colors">WEB予約</Link>
            </div>
          </div>

          {/* SNS & お問い合わせ & Google Maps */}
          <div>
            <h4 className={`text-sm font-semibold mb-3 border-b pb-1 inline-block tracking-widest ${
              isCyberTheme ? 'neon-text-pink border-[#ff8fc9]/40' : 'border-[#d1b464]/30'
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
                      ? 'bg-[#1a0933] border-[#ff8fc9]/40 text-pink-100 hover:border-[#ff8fc9]'
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
                  className={`px-3.5 py-1.5 border text-[11px] rounded transition-colors ${
                    isCyberTheme
                      ? 'bg-[#1a0933] border-[#ff8fc9]/40 text-pink-100 hover:border-[#ff8fc9]'
                      : 'bg-stone-900 border-[#d1b464]/40 hover:border-[#d1b464] text-stone-200'
                  }`}
                >
                  💬 公式LINE
                </a>
              )}
              {store.googleMapUrl && (
                <a
                  href={store.googleMapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-3.5 py-1.5 border text-[11px] rounded transition-colors ${
                    isCyberTheme
                      ? 'bg-[#1a0933] border-[#ff8fc9]/40 text-pink-100 hover:border-[#ff8fc9]'
                      : 'bg-stone-900 border-[#d1b464]/40 hover:border-[#d1b464] text-stone-200'
                  }`}
                >
                  📍 Google Maps
                </a>
              )}
            </div>
            <Link
              href={`${basePath}/reserve`}
              style={{ backgroundColor: isCyberTheme ? '#ff8fc9' : undefined }}
              className={`inline-block w-full py-3 text-center text-white font-bold text-xs tracking-widest shadow-md transition-all ${
                isCyberTheme
                  ? 'bg-[#ff8fc9] hover:bg-[#ffb8e0] rounded-full shadow-[0_0_15px_rgba(255,143,201,0.6)]'
                  : 'bg-gradient-to-r from-[#d1b464] to-[#a39573] rounded-sm hover:brightness-105'
              }`}
            >
              24時間 WEB予約 🐾
            </Link>
          </div>
        </div>

        <div className={`border-t pt-6 text-center text-[11px] tracking-widest ${
          isCyberTheme ? 'border-[#ff8fc9]/20 text-pink-300' : 'border-stone-800 text-stone-500'
        }`}>
          © {new Date().getFullYear()} {store.name}. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
};
