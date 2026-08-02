'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { Header } from '../../../../../components/store/Header';
import { Footer } from '../../../../../components/store/Footer';
import { MOCK_STORE, MOCK_BLOG_ARTICLES } from '../../../../../mock/specialgrade';

export default function DiaryDetailPage({
  params,
}: {
  params: Promise<{ shopSlug: string; id: string }>;
}) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const blogId = resolvedParams.id;

  const article = MOCK_BLOG_ARTICLES.find((a) => a.id === blogId) || MOCK_BLOG_ARTICLES[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header store={MOCK_STORE} />

      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 w-full">
        <article className="bg-slate-900/80 rounded-3xl border border-slate-800 p-6 sm:p-10 shadow-2xl space-y-6">
          {/* ヘッダー情報 */}
          <div className="border-b border-slate-800 pb-6 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="bg-slate-800 text-rose-300 px-3 py-1 rounded-full font-medium">
                セラピスト日記
              </span>
              <span>{article.publishedAt}</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
              {article.title}
            </h1>

            <Link
              href={`/${shopSlug}/therapists/${article.therapistId}`}
              className="inline-flex items-center gap-3 p-2 bg-slate-950/60 rounded-xl border border-slate-800 hover:border-rose-500/40 transition-colors"
            >
              <img
                src={article.therapistAvatar}
                alt={article.therapistName}
                className="w-10 h-10 rounded-full object-cover border border-rose-500/30"
              />
              <div>
                <div className="text-xs font-bold text-slate-200">{article.therapistName}</div>
                <div className="text-[10px] text-rose-400">プロフィールを見る →</div>
              </div>
            </Link>
          </div>

          {/* アイキャッチ画像 */}
          {article.eyeCatchUrl && (
            <div className="rounded-2xl overflow-hidden border border-slate-800">
              <img
                src={article.eyeCatchUrl}
                alt={article.title}
                className="w-full max-h-96 object-cover"
              />
            </div>
          )}

          {/* 本文 */}
          <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-line space-y-4 font-sans">
            {article.content}
          </div>

          {/* アクション */}
          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <Link
              href={`/${shopSlug}/diary`}
              className="text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
              ← 日記一覧へ戻る
            </Link>

            <Link
              href={`/${shopSlug}/reserve?therapistId=${article.therapistId}`}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 text-center hover:scale-105 transition-transform"
            >
              {article.therapistName} さんを指名予約する
            </Link>
          </div>
        </article>
      </main>

      <Footer store={MOCK_STORE} />
    </div>
  );
}
