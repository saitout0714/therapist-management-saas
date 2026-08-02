import React from 'react';
import Link from 'next/link';
import { StoreConfig } from '../../types/store';

interface FooterProps {
  store: StoreConfig;
}

export const Footer: React.FC<FooterProps> = ({ store }) => {
  const basePath = `/${store.slug}`;

  return (
    <footer className="bg-[#1f1d1a] text-stone-300 border-t border-[#d1b464]/30 pt-12 pb-8 font-serif">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* 店舗情報 */}
          <div>
            <h3 className="text-xl font-bold text-[#d1b464] mb-3 tracking-wider">
              {store.name}
            </h3>
            <p className="text-xs text-stone-400 mb-4 tracking-widest">{store.catchphrase}</p>
            <div className="space-y-2 text-xs text-stone-300">
              <p><span className="text-[#a39573]">住所：</span>{store.address}</p>
              <p><span className="text-[#a39573]">アクセス：</span>{store.accessInfo}</p>
              <p><span className="text-[#a39573]">営業時間：</span>{store.businessHours}</p>
              <p><span className="text-[#a39573]">電話番号：</span>{store.phoneNumber}</p>
            </div>
          </div>

          {/* クイックリンク */}
          <div className="space-y-2 text-xs">
            <h4 className="text-sm font-semibold text-[#d1b464] mb-3 border-b border-[#d1b464]/30 pb-1 inline-block tracking-widest">
              CONTENTS
            </h4>
            <div className="grid grid-cols-2 gap-2 text-stone-300">
              <Link href={basePath} className="hover:text-[#d1b464] transition-colors">TOP</Link>
              <Link href={`${basePath}/system`} className="hover:text-[#d1b464] transition-colors">システム・料金</Link>
              <Link href={`${basePath}/therapists`} className="hover:text-[#d1b464] transition-colors">セラピスト一覧</Link>
              <Link href={`${basePath}/schedule`} className="hover:text-[#d1b464] transition-colors">出勤スケジュール</Link>
              <Link href={`${basePath}/diary`} className="hover:text-[#d1b464] transition-colors">セラピスト日記</Link>
              <Link href={`${basePath}/access`} className="hover:text-[#d1b464] transition-colors">アクセス</Link>
              <Link href={`${basePath}/recruit`} className="hover:text-[#d1b464] transition-colors">求人情報</Link>
              <Link href={`${basePath}/reserve`} className="hover:text-[#d1b464] transition-colors">WEB予約</Link>
            </div>
          </div>

          {/* SNS & お問い合わせ */}
          <div>
            <h4 className="text-sm font-semibold text-[#d1b464] mb-3 border-b border-[#d1b464]/30 pb-1 inline-block tracking-widest">
              CONTACT & SNS
            </h4>
            <div className="flex gap-3 mb-4">
              {store.xUrl && (
                <a
                  href={store.xUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-stone-900 border border-[#d1b464]/40 hover:border-[#d1b464] text-stone-200 text-xs rounded transition-colors"
                >
                  X (Twitter)
                </a>
              )}
            </div>
            <Link
              href={`${basePath}/reserve`}
              className="inline-block w-full py-3 text-center bg-gradient-to-r from-[#d1b464] to-[#a39573] text-white font-bold text-xs tracking-widest shadow-md hover:brightness-105 transition-all"
            >
              24時間 WEB予約
            </Link>
          </div>
        </div>

        <div className="border-t border-stone-800 pt-6 text-center text-[11px] text-stone-500 tracking-widest">
          © {new Date().getFullYear()} {store.name}. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
};
