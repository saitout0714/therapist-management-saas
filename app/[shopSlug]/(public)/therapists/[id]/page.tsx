'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Header } from '../../../../../components/store/Header';
import { Footer } from '../../../../../components/store/Footer';
import { ThemeProvider } from '../../../../../components/store/ThemeProvider';
import {
  fetchStoreConfig,
  fetchTherapistDetail,
  fetchBlogArticles,
  fetchConfirmedShifts,
} from '../../../../../lib/storeApi';
import { StoreConfig, Therapist, BlogArticle, ConfirmedShift } from '../../../../../types/store';
import { MOCK_STORE, MOCK_THERAPISTS } from '../../../../../mock/specialgrade';

export default function TherapistDetailPage({
  params,
}: {
  params: Promise<{ shopSlug: string; id: string }>;
}) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const therapistId = resolvedParams.id;

  const [store, setStore] = useState<StoreConfig>(MOCK_STORE);
  const [therapist, setTherapist] = useState<Therapist | null>(null);
  const [blogs, setBlogs] = useState<BlogArticle[]>([]);
  const [todayShift, setTodayShift] = useState<ConfirmedShift | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);

  useEffect(() => {
    async function loadData() {
      const storeConfig = await fetchStoreConfig(shopSlug);
      setStore(storeConfig);

      const [detail, bList] = await Promise.all([
        fetchTherapistDetail(therapistId),
        fetchBlogArticles(storeConfig.id, therapistId),
      ]);

      setTherapist(detail);
      setBlogs(bList);

      // 本日の部屋割り確定済みシフトを取得
      const todayStr = new Date().toISOString().split('T')[0];
      const confirmedShifts = await fetchConfirmedShifts(storeConfig.id, todayStr, todayStr);
      const shift = confirmedShifts.find((s) => s.therapistId === therapistId);
      if (shift) {
        setTodayShift(shift);
      }
    }
    loadData();
  }, [shopSlug, therapistId]);

  const currentTherapist = therapist || MOCK_THERAPISTS[0];
  const photos = currentTherapist.images && currentTherapist.images.length > 0
    ? currentTherapist.images
    : [currentTherapist.avatarUrl];

  const mainPhoto = photos[selectedPhotoIndex] || photos[0] || currentTherapist.avatarUrl;

  return (
    <ThemeProvider store={store}>
      <div className="min-h-screen bg-[#faf9f5] text-stone-800 flex flex-col font-serif">
      <Header store={store} />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-12 w-full">
        <div className="bg-white rounded-sm border border-[#d1b464]/30 overflow-hidden shadow-sm p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* 写真＆ギャラリー (登録画像全件表示) */}
            <div className="space-y-4">
              <div className="aspect-[3/4] w-full rounded-sm overflow-hidden bg-stone-100 border border-stone-200 relative">
                <img
                  src={mainPhoto}
                  alt={currentTherapist.name}
                  className="w-full h-full object-cover transition-all duration-300"
                />
                {(currentTherapist.isRookie || currentTherapist.badge) && (
                  <span className="absolute top-3 left-3 bg-[#d1b464] text-white font-bold text-[10px] px-3 py-1 rounded-sm shadow-sm tracking-wider">
                    {currentTherapist.isRookie ? '新人' : currentTherapist.badge}
                  </span>
                )}
                {(currentTherapist.rankName || currentTherapist.grade) && (
                  <span className="absolute top-3 right-3 bg-stone-900/80 text-[#d1b464] border border-[#d1b464]/40 font-semibold text-[10px] px-2.5 py-1 rounded-sm tracking-wider">
                    {currentTherapist.rankName || currentTherapist.grade}
                  </span>
                )}
              </div>

              {/* 写真ギャラリー サムネイル一覧 */}
              {photos.length > 1 && (
                <div>
                  <p className="text-[11px] text-[#a39573] font-bold mb-2 tracking-wider">
                    登録画像ギャラリー ({photos.length}枚)
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {photos.map((img, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedPhotoIndex(idx)}
                        className={`aspect-square rounded-sm overflow-hidden border cursor-pointer transition-all ${
                          selectedPhotoIndex === idx
                            ? 'border-[#d1b464] ring-2 ring-[#d1b464]/50 opacity-100 scale-105'
                            : 'border-stone-200 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={img}
                          alt={`${currentTherapist.name}-${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* プロフィール詳細情報 */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-stone-800 tracking-wider">{currentTherapist.name}</h1>
                  {currentTherapist.nameKana && (
                    <span className="text-xs text-stone-400">({currentTherapist.nameKana})</span>
                  )}
                  <span className="text-sm font-semibold text-[#a39573]">({currentTherapist.age}歳)</span>
                </div>

                {/* サイズ情報（T / B / W / H） */}
                <div className="text-xs font-semibold text-stone-600 tracking-wide mt-2 space-y-1 bg-[#faf7f0] p-3 rounded-sm border border-[#d1b464]/20">
                  <p>
                    <span className="text-[#a39573] font-bold">身長:</span> T{currentTherapist.height}cm &nbsp;|&nbsp;{' '}
                    <span className="text-[#a39573] font-bold">バスト:</span> {currentTherapist.bustCup}カップ
                    {currentTherapist.bust && ` (${currentTherapist.bust}cm)`}
                  </p>
                  {(currentTherapist.waist || currentTherapist.hip) && (
                    <p>
                      {currentTherapist.waist && <><span className="text-[#a39573] font-bold">ウエスト:</span> W{currentTherapist.waist}cm &nbsp;|&nbsp; </>}
                      {currentTherapist.hip && <><span className="text-[#a39573] font-bold">ヒップ:</span> H{currentTherapist.hip}cm</>}
                    </p>
                  )}
                  {currentTherapist.threeSize && (
                    <p className="text-[11px] text-stone-500">{currentTherapist.threeSize}</p>
                  )}
                </div>
              </div>

              {/* タグ一覧 */}
              <div className="flex flex-wrap gap-1.5">
                {currentTherapist.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-medium bg-[#faf7f0] text-[#a39573] px-3 py-1 rounded-sm border border-[#d1b464]/30"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              {/* 自己PRメッセージ (comment) */}
              <div className="bg-[#faf7f0] rounded-sm p-4 border border-[#d1b464]/20 space-y-2">
                <h3 className="text-xs font-bold text-[#a39573] tracking-widest uppercase">
                  自己PR / MESSAGE
                </h3>
                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed italic tracking-wider whitespace-pre-wrap">
                  {currentTherapist.comment ? `"${currentTherapist.comment}"` : '心からの癒やしをご提供いたします。'}
                </p>
              </div>

              {/* 本日の出勤状況 (部屋割り確定リアルタイム連動) */}
              <div className="bg-[#faf7f0] rounded-sm p-4 border border-[#d1b464]/20 space-y-2">
                <h3 className="text-xs font-bold text-[#a39573] tracking-widest uppercase">
                  本日の出勤シフト (Yoyakl部屋割り確定済み)
                </h3>
                <div className="flex items-center justify-between">
                  {todayShift ? (
                    <>
                      <span className="text-xs text-stone-800 font-bold">
                        {todayShift.startTime} ～ {todayShift.endTime}
                        {todayShift.roomName && ` (${todayShift.roomName})`}
                      </span>
                      <span className="text-xs bg-[#d1b464] text-white px-2.5 py-0.5 rounded-sm font-medium tracking-wider">
                        出勤中 / 確定
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-stone-500">本日はお休み、または調整中です</span>
                      <span className="text-xs bg-stone-200 text-stone-600 px-2.5 py-0.5 rounded-sm font-medium">
                        シフトなし
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* 他店舗連携情報 */}
              {currentTherapist.affiliatedShops && currentTherapist.affiliatedShops.length > 0 && (
                <div className="bg-white p-3 rounded-sm border border-stone-200 text-xs text-stone-600 space-y-1">
                  <span className="font-bold text-[#a39573] tracking-wider block">【グループ・他店舗連携】</span>
                  <p>同グループの他店舗でも活躍中:</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {currentTherapist.affiliatedShops.map((s) => (
                      <span key={s.id} className="bg-stone-100 px-2 py-0.5 rounded text-[11px] font-semibold text-stone-700">
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 指名予約アクション */}
              <Link
                href={`/${shopSlug}/reserve?therapistId=${currentTherapist.id}`}
                className="block w-full py-3.5 text-center bg-gradient-to-r from-[#d1b464] to-[#a39573] text-white font-bold text-xs rounded-sm shadow-md hover:brightness-105 transition-all tracking-widest"
              >
                {currentTherapist.name} さんを指名予約する
              </Link>
            </div>
          </div>

          {/* 個人ブログ */}
          {blogs.length > 0 && (
            <div className="mt-12 border-t border-stone-200 pt-8 space-y-4">
              <h2 className="text-lg font-bold text-stone-800 tracking-wider">
                {currentTherapist.name} の日記
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {blogs.map((b) => (
                  <Link
                    key={b.id}
                    href={`/${shopSlug}/diary/${b.id}`}
                    className="bg-[#faf7f0] p-4 rounded-sm border border-[#d1b464]/20 hover:border-[#a39573] transition-colors"
                  >
                    <div className="text-[10px] text-stone-400 mb-1">{b.publishedAt}</div>
                    <h3 className="font-bold text-xs text-stone-800 hover:text-[#a39573] transition-colors leading-snug">
                      {b.title}
                    </h3>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer store={store} />
    </div>
    </ThemeProvider>
  );
}

