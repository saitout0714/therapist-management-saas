import React from 'react';
import Link from 'next/link';
import { StoreConfig } from '../../types/store';

interface FooterProps {
  store: StoreConfig;
}

export const Footer: React.FC<FooterProps> = ({ store }) => {
  const basePath = `/${store.slug}`;

  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-900 pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* 店舗情報 */}
          <div>
            <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-300 mb-3">
              {store.name}
            </h3>
            <p className="text-xs text-slate-400 mb-4">{store.catchphrase}</p>
            <div className="space-y-2 text-xs">
              <p><span className="text-slate-500">住所：</span>{store.address}</p>
              <p><span className="text-slate-500">アクセス：</span>{store.accessInfo}</p>
              <p><span className="text-slate-500">営業時間：</span>{store.businessHours}</p>
              <p><span className="text-slate-500">電話番号：</span>{store.phoneNumber}</p>
            </div>
          </div>

          {/* クイックリンク */}
          <div className="space-y-2 text-xs">
            <h4 className="text-sm font-semibold text-slate-200 mb-3 border-l-2 border-rose-500 pl-2">
              コンテンツ
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <Link href={basePath} className="hover:text-rose-400 transition-colors">TOP</Link>
              <Link href={`${basePath}/system`} className="hover:text-rose-400 transition-colors">システム・料金</Link>
              <Link href={`${basePath}/therapists`} className="hover:text-rose-400 transition-colors">セラピスト一覧</Link>
              <Link href={`${basePath}/schedule`} className="hover:text-rose-400 transition-colors">出勤スケジュール</Link>
              <Link href={`${basePath}/diary`} className="hover:text-rose-400 transition-colors">セラピスト日記</Link>
              <Link href={`${basePath}/access`} className="hover:text-rose-400 transition-colors">アクセス</Link>
              <Link href={`${basePath}/recruit`} className="hover:text-rose-400 transition-colors">求人情報</Link>
              <Link href={`${basePath}/reserve`} className="hover:text-rose-400 transition-colors">WEB予約</Link>
            </div>
          </div>

          {/* SNS & お問い合わせ */}
          <div>
            <h4 className="text-sm font-semibold text-slate-200 mb-3 border-l-2 border-rose-500 pl-2">
              公式SNS・ご予約
            </h4>
            <div className="flex gap-3 mb-4">
              {store.xUrl && (
                <a
                  href={store.xUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <span className="font-bold">X</span> (Twitter)
                </a>
              )}
              {store.litlinkUrl && (
                <a
                  href={store.litlinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  Lit.link
                </a>
              )}
            </div>
            <Link
              href={`${basePath}/reserve`}
              className="inline-block w-full py-3 text-center bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 hover:scale-[1.02] transition-transform"
            >
              今すぐ24時間WEB予約
            </Link>
          </div>
        </div>

        <div className="border-t border-slate-900 pt-6 text-center text-[11px] text-slate-600">
          © {new Date().getFullYear()} {store.name}. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
};
