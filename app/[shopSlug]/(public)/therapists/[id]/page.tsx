'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { Header } from '../../../../../components/store/Header';
import { Footer } from '../../../../../components/store/Footer';
import { MOCK_STORE, MOCK_THERAPISTS, MOCK_BLOG_ARTICLES } from '../../../../../mock/specialgrade';

export default function TherapistDetailPage({
  params,
}: {
  params: Promise<{ shopSlug: string; id: string }>;
}) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const therapistId = resolvedParams.id;

  const therapist = MOCK_THERAPISTS.find((t) => t.id === therapistId) || MOCK_THERAPISTS[0];
  const blogs = MOCK_BLOG_ARTICLES.filter((b) => b.therapistId === therapist.id);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header store={MOCK_STORE} />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-12 w-full">
        <div className="bg-slate-900/80 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* 写真＆ギャラリー */}
            <div className="space-y-4">
              <div className="aspect-[3/4] w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 relative">
                <img
                  src={therapist.avatarUrl}
                  alt={therapist.name}
                  className="w-full h-full object-cover"
                />
                {therapist.badge && (
                  <span className="absolute top-4 left-4 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-extrabold text-xs px-3.5 py-1 rounded-full shadow-lg">
                    {therapist.badge}
                  </span>
                )}
              </div>

              {therapist.images.length > 1 && (
                <div className="grid grid-cols-3 gap-2">
                  {therapist.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`${therapist.name}-${idx}`}
                      className="aspect-square rounded-xl object-cover border border-slate-800 hover:opacity-90 cursor-pointer transition-opacity"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* プロフィール情報 */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-extrabold text-white">{therapist.name}</h1>
                  <span className="text-lg font-bold text-rose-400">({therapist.age}歳)</span>
                </div>
                <p className="text-sm font-semibold text-slate-300">
                  T{therapist.height}cm / {therapist.bustCup}カップ {therapist.threeSize && `(${therapist.threeSize})`}
                </p>
              </div>

              {/* タグ一覧 */}
              <div className="flex flex-wrap gap-2">
                {therapist.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-semibold bg-slate-800 text-rose-300 px-3 py-1 rounded-lg border border-rose-500/20"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              {/* メッセージ */}
              <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  メッセージ
                </h3>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed italic">
                  "{therapist.comment}"
                </p>
              </div>

              {/* 出勤状況 (モック) */}
              <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  本日の出勤情報
                </h3>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-rose-300 font-bold">13:00 ～ 22:00</span>
                  <span className="text-xs bg-rose-950 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded font-medium">
                    予約受付中
                  </span>
                </div>
              </div>

              {/* 指名予約アクション */}
              <Link
                href={`/${shopSlug}/reserve?therapistId=${therapist.id}`}
                className="block w-full py-4 text-center bg-gradient-to-r from-rose-600 to-pink-600 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-rose-600/30 hover:scale-[1.02] transition-transform"
              >
                {therapist.name} さんを指名予約する
              </Link>
            </div>
          </div>

          {/* 個人ブログ */}
          {blogs.length > 0 && (
            <div className="mt-12 border-t border-slate-800 pt-8 space-y-4">
              <h2 className="text-xl font-bold text-white border-l-4 border-rose-500 pl-3">
                {therapist.name} の日記
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {blogs.map((b) => (
                  <Link
                    key={b.id}
                    href={`/${shopSlug}/diary/${b.id}`}
                    className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 hover:border-rose-500/40 transition-colors"
                  >
                    <div className="text-[10px] text-slate-500 mb-1">{b.publishedAt}</div>
                    <h3 className="font-bold text-sm text-slate-100 hover:text-rose-300 transition-colors">
                      {b.title}
                    </h3>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer store={MOCK_STORE} />
    </div>
  );
}
