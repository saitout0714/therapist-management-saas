'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Header } from '../../../../../components/store/Header';
import { Footer } from '../../../../../components/store/Footer';
import { ThemeProvider } from '../../../../../components/store/ThemeProvider';
import { ImageLightboxModal } from '../../../../../components/store/ImageLightboxModal';
import {
  fetchStoreConfig,
  fetchTherapistDetail,
  fetchBlogArticles,
  fetchConfirmedShifts,
} from '../../../../../lib/storeApi';
import { StoreConfig, Therapist, BlogArticle, ConfirmedShift } from '../../../../../types/store';
import { MOCK_STORE, MOCK_THERAPISTS } from '../../../../../mock/specialgrade';
import { MOCK_ONYANKO_STORE, MOCK_ONYANKO_THERAPISTS } from '../../../../../mock/onyankospa';

export default function TherapistDetailPage({
  params,
}: {
  params: Promise<{ shopSlug: string; id: string }>;
}) {
  const resolvedParams = use(params);
  const shopSlug = resolvedParams.shopSlug || 'specialgrade';
  const therapistId = resolvedParams.id;
  const isOnyanko = shopSlug === 'onyankospa';
  const initialTherapist = isOnyanko
    ? (MOCK_ONYANKO_THERAPISTS.find((t) => t.id === therapistId) || MOCK_ONYANKO_THERAPISTS[0])
    : (MOCK_THERAPISTS.find((t) => t.id === therapistId) || MOCK_THERAPISTS[0]);

  const [store, setStore] = useState<StoreConfig>(isOnyanko ? MOCK_ONYANKO_STORE : MOCK_STORE);
  const [therapist, setTherapist] = useState<Therapist | null>(initialTherapist);
  const [blogs, setBlogs] = useState<BlogArticle[]>([]);
  const [todayShift, setTodayShift] = useState<ConfirmedShift | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);

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

  const isCyberTheme = shopSlug === 'onyankospa';

  return (
    <ThemeProvider store={store}>
      <div className={`min-h-screen flex flex-col ${
        isCyberTheme ? 'cyber-bg text-stone-100 font-sans' : 'bg-[#faf9f5] text-stone-800 font-serif'
      }`}>
      <Header store={store} />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-12 w-full">
        <div className={`p-6 sm:p-8 ${
          isCyberTheme
            ? 'cyber-card rounded-2xl border-[#ff007f]/40'
            : 'bg-white rounded-sm border border-[#d1b464]/30 shadow-sm'
        }`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* 写真＆ギャラリー (登録画像全件表示) */}
            <div className="space-y-4">
              <div
                onClick={() => setIsLightboxOpen(true)}
                className={`aspect-[3/4] w-full rounded-2xl overflow-hidden bg-stone-900 border relative cursor-pointer group shadow-lg ${
                  isCyberTheme ? 'border-[#ff007f]/40 hover:border-[#ff007f]' : 'border-stone-800'
                }`}
              >
                <img
                  src={mainPhoto}
                  alt={currentTherapist.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 bg-stone-950/80 text-white font-bold text-xs px-3 py-1.5 rounded-full border border-white/20 transition-opacity">
                    🔍 タップで拡大表示
                  </span>
                </div>
                {(currentTherapist.isRookie || currentTherapist.badge) && (
                  <span className={`absolute top-3 left-3 text-white font-bold text-[10px] px-3 py-1 rounded-full shadow-sm tracking-wider ${
                    isCyberTheme ? 'neon-badge-pink' : 'bg-[#d1b464] text-stone-950'
                  }`}>
                    {currentTherapist.isRookie ? '新人' : currentTherapist.badge}
                  </span>
                )}
                {(currentTherapist.rankName || currentTherapist.grade) && (
                  <span className={`absolute top-3 right-3 bg-stone-900/80 border font-semibold text-[10px] px-2.5 py-1 rounded-full tracking-wider ${
                    isCyberTheme ? 'text-[#ff2a8d] border-[#ff007f]' : 'text-[#d1b464] border-[#d1b464]/40'
                  }`}>
                    {currentTherapist.rankName || currentTherapist.grade}
                  </span>
                )}
              </div>

              {/* 写真ギャラリー サムネイル一覧 */}
              {photos.length > 1 && (
                <div>
                  <p className={`text-[11px] font-bold mb-2 tracking-wider ${
                    isCyberTheme ? 'neon-text-pink' : 'text-[#a39573]'
                  }`}>
                    登録画像ギャラリー ({photos.length}枚)
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {photos.map((img, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedPhotoIndex(idx)}
                        className={`aspect-square rounded-lg overflow-hidden border cursor-pointer transition-all ${
                          selectedPhotoIndex === idx
                            ? isCyberTheme ? 'border-[#ff007f] ring-2 ring-[#ff007f]/50 opacity-100 scale-105' : 'border-[#d1b464] ring-2 ring-[#d1b464]/50 opacity-100 scale-105'
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
                <div className="flex items-baseline gap-3 mb-1">
                  <h1 className={`text-2xl font-bold tracking-wider ${isCyberTheme ? 'neon-text-pink' : 'text-stone-800'}`}>{currentTherapist.name}</h1>
                  {currentTherapist.nameKana && (
                    <span className={`text-xs ${isCyberTheme ? 'text-pink-300' : 'text-stone-400'}`}>({currentTherapist.nameKana})</span>
                  )}
                  <span className={`text-sm font-semibold ${isCyberTheme ? 'text-[#ff2a8d]' : 'text-[#a39573]'}`}>({currentTherapist.age}歳)</span>
                </div>

                {/* サイズ情報（T / B / W / H） */}
                <div className={`text-xs font-semibold tracking-wide mt-2 space-y-1 p-3 rounded-xl border ${
                  isCyberTheme
                    ? 'bg-[#050014]/90 text-pink-100 border-[#ff007f]/30'
                    : 'bg-[#faf7f0] text-stone-600 border-[#d1b464]/20'
                }`}>
                  <p>
                    <span className={isCyberTheme ? 'text-[#ff2a8d] font-bold' : 'text-[#a39573] font-bold'}>身長:</span> T{currentTherapist.height}cm &nbsp;|&nbsp;{' '}
                    <span className={isCyberTheme ? 'text-[#ff2a8d] font-bold' : 'text-[#a39573] font-bold'}>バスト:</span> {currentTherapist.bustCup}カップ
                    {currentTherapist.bust && ` (${currentTherapist.bust}cm)`}
                  </p>
                  {(currentTherapist.waist || currentTherapist.hip) && (
                    <p>
                      {currentTherapist.waist && <><span className={isCyberTheme ? 'text-[#ff2a8d] font-bold' : 'text-[#a39573] font-bold'}>ウエスト:</span> W{currentTherapist.waist}cm &nbsp;|&nbsp; </>}
                      {currentTherapist.hip && <><span className={isCyberTheme ? 'text-[#ff2a8d] font-bold' : 'text-[#a39573] font-bold'}>ヒップ:</span> H{currentTherapist.hip}cm</>}
                    </p>
                  )}
                  {currentTherapist.threeSize && (
                    <p className={`text-[11px] ${isCyberTheme ? 'text-pink-300/80' : 'text-stone-500'}`}>{currentTherapist.threeSize}</p>
                  )}
                </div>
              </div>

              {/* タグ一覧 */}
              <div className="flex flex-wrap gap-1.5">
                {currentTherapist.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`text-xs font-medium px-3 py-1 border ${
                      isCyberTheme
                        ? 'bg-[#050014]/80 text-pink-200 border-[#ff007f]/40 rounded-full'
                        : 'bg-[#faf7f0] text-[#a39573] border-[#d1b464]/30 rounded-sm'
                    }`}
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              {/* 自己PRメッセージ (comment) */}
              <div className={`p-4 border space-y-2 ${
                isCyberTheme
                  ? 'bg-[#050014]/90 border-[#ff007f]/30 rounded-xl'
                  : 'bg-[#faf7f0] border-[#d1b464]/20 rounded-sm'
              }`}>
                <h3 className={`text-xs font-bold tracking-widest uppercase ${
                  isCyberTheme ? 'neon-text-pink' : 'text-[#a39573]'
                }`}>
                  自己PR / MESSAGE
                </h3>
                <p className={`text-xs sm:text-sm leading-relaxed italic tracking-wider whitespace-pre-wrap ${
                  isCyberTheme ? 'text-pink-100' : 'text-stone-700'
                }`}>
                  {currentTherapist.comment ? `"${currentTherapist.comment}"` : '心からの癒やしをご提供いたします。'}
                </p>
              </div>

              {/* 本日の出勤状況 */}
              <div className={`p-4 border space-y-2 ${
                isCyberTheme
                  ? 'bg-[#050014]/90 border-[#ff007f]/30 rounded-xl'
                  : 'bg-[#faf7f0] border-[#d1b464]/20 rounded-sm'
              }`}>
                <h3 className={`text-xs font-bold tracking-widest uppercase ${
                  isCyberTheme ? 'neon-text-pink' : 'text-[#a39573]'
                }`}>
                  本日の出勤シフト
                </h3>
                <div className="flex items-center justify-between">
                  {todayShift ? (
                    <>
                      <span className={`text-xs font-bold ${isCyberTheme ? 'text-white' : 'text-stone-800'}`}>
                        {todayShift.startTime} ～ {todayShift.endTime}
                        {todayShift.roomName && ` (${todayShift.roomName})`}
                      </span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium tracking-wider text-white ${
                        isCyberTheme ? 'bg-[#ff007f] shadow-[0_0_10px_rgba(255,0,127,0.5)]' : 'bg-[#d1b464]'
                      }`}>
                        出勤中 / 確定
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={`text-xs ${isCyberTheme ? 'text-pink-300/70' : 'text-stone-500'}`}>本日はお休み、または調整中です</span>
                      <Link
                        href={`/${shopSlug}/schedule`}
                        className={`text-xs font-bold underline ${isCyberTheme ? 'text-[#ff2a8d]' : 'text-[#a39573]'}`}
                      >
                        他日程を見る
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {/* 指名WEB予約ボタン */}
              <div className="pt-2">
                <Link
                  href={`/${shopSlug}/reserve?therapistId=${currentTherapist.id}`}
                  className={`block w-full py-4 text-center text-white font-bold text-sm tracking-widest transition-all ${
                    isCyberTheme
                      ? 'bg-[#ff007f] hover:bg-[#ff2a8d] rounded-full shadow-[0_0_20px_rgba(255,0,127,0.7)] animate-neon-pulse'
                      : 'bg-gradient-to-r from-[#d1b464] to-[#a39573] rounded-sm hover:brightness-105 shadow-md'
                  }`}
                >
                  {currentTherapist.name}さんを指名WEB予約する 🐾
                </Link>
              </div>
            </div>
          </div>

          {/* セラピストの投稿日記一覧 */}
          {blogs.length > 0 && (
            <div className="mt-12 pt-8 border-t border-stone-200 space-y-4">
              <h3 className={`text-lg font-bold tracking-wider ${isCyberTheme ? 'neon-text-pink' : 'text-stone-800'}`}>
                {currentTherapist.name}さんの写メ日記 ({blogs.length}件)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {blogs.map((b) => (
                  <Link
                    key={b.id}
                    href={`/${shopSlug}/diary/${b.id}`}
                    className={`p-3.5 border transition-all flex gap-3 ${
                      isCyberTheme
                        ? 'cyber-card rounded-xl border-[#ff007f]/30 hover:border-[#ff007f]'
                        : 'bg-[#faf7f0] rounded-sm border-[#d1b464]/20 hover:border-[#a39573]'
                    }`}
                  >
                    {b.eyeCatchUrl && (
                      <img
                        src={b.eyeCatchUrl}
                        alt={b.title}
                        className="w-16 h-16 rounded-md object-cover border border-stone-200 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[10px] ${isCyberTheme ? 'text-pink-300' : 'text-stone-400'}`}>{b.publishedAt}</p>
                      <h4 className={`text-xs font-bold line-clamp-1 ${isCyberTheme ? 'text-white' : 'text-stone-800'}`}>{b.title}</h4>
                      <p className={`text-[11px] line-clamp-2 mt-0.5 ${isCyberTheme ? 'text-pink-100/80' : 'text-stone-600'}`}>{b.content}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer store={store} />

      {/* フルサイズ画像ライトボックスモーダル */}
      <ImageLightboxModal
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        images={photos}
        currentIndex={selectedPhotoIndex}
        onSelectIndex={(idx) => setSelectedPhotoIndex(idx)}
        isCyber={isCyberTheme}
      />
    </div>
    </ThemeProvider>
  );
}

