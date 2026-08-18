'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from './Header';
import { Footer } from './Footer';
import { ThemeProvider } from './ThemeProvider';
import { ImageLightboxModal } from './ImageLightboxModal';
import { StoreConfig, Therapist, BlogArticle, ConfirmedShift } from '../../types/store';
// 写メ日記の表示可否はページ側で判定し、無効時は blogs に空配列が渡る。

import { CyberParallaxBackground } from './CyberParallaxBackground';

interface TherapistDetailViewProps {
  shopSlug: string;
  store: StoreConfig;
  therapist: Therapist | null;
  blogs: BlogArticle[];
  todayShift: ConfirmedShift | null;
}

/**
 * セラピスト詳細の表示部分。
 *
 * データ取得はページ側（サーバーコンポーネント）に移し、ここは props で受け取る。
 * 以前は useEffect で取得していたためHTMLに本文が載らず、
 * セラピスト名・プロフィールがクローラから見えていなかった。
 * 写真ギャラリーの選択状態とライトボックスの開閉だけがクライアント状態として残る。
 */
export const TherapistDetailView: React.FC<TherapistDetailViewProps> = ({
  shopSlug,
  store,
  therapist,
  blogs,
  todayShift,
}) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);

  const isCyberTheme = shopSlug === 'onyankospa';

  if (!therapist) {
    return (
      <ThemeProvider store={store}>
        <div className={`min-h-screen flex flex-col relative ${
          isCyberTheme ? 'cyber-bg text-[#f4eefa]' : 'bg-[#faf9f5] text-stone-800 font-serif'
        }`}>
          {isCyberTheme && <CyberParallaxBackground variant="medium" pageType="therapists" />}
          <Header store={store} />
          <main className="flex-1 max-w-5xl mx-auto px-4 py-24 w-full text-center relative z-10">
            {/* サーバー側で取得済みなので、ここに来るのは該当セラピストが存在しない場合のみ */}
            <p className={`text-xs tracking-widest ${isCyberTheme ? 'text-[#ffa8d8]' : 'text-stone-400'}`}>
              このセラピストは現在ご紹介しておりません。
            </p>
          </main>
          <Footer store={store} />
        </div>
      </ThemeProvider>
    );
  }

  const currentTherapist = therapist;
  const photos = currentTherapist.images && currentTherapist.images.length > 0
    ? currentTherapist.images
    : [currentTherapist.avatarUrl];

  const mainPhoto = photos[selectedPhotoIndex] || photos[0] || currentTherapist.avatarUrl;

  return (
    <ThemeProvider store={store}>
      <div className={`min-h-screen flex flex-col relative ${
        isCyberTheme ? 'cyber-bg text-[#f4eefa]' : 'bg-[#faf9f5] text-stone-800 font-serif'
      }`}>
        {isCyberTheme && <CyberParallaxBackground variant="medium" pageType="therapists" />}
        <Header store={store} />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-12 w-full relative z-10">
        <div className={`p-6 sm:p-8 ${
          isCyberTheme
            ? 'cyber-card reveal rounded-2xl border-[#ff6fb5]/40'
            : 'bg-white rounded-sm border border-[#d1b464]/30 shadow-sm'
        }`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* 写真＆ギャラリー (登録画像全件表示) */}
            <div className="space-y-4">
              <div
                onClick={() => setIsLightboxOpen(true)}
                className={`aspect-[3/4] w-full rounded-2xl overflow-hidden bg-stone-900 border relative cursor-pointer group shadow-lg ${
                  isCyberTheme ? 'border-[#ff6fb5]/40 hover:border-[#ff6fb5]' : 'border-stone-800'
                }`}
              >
                <Image
                  src={mainPhoto}
                  alt={currentTherapist.name}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 bg-stone-950/80 text-white font-bold text-xs px-3 py-1.5 rounded-full border border-white/20 transition-opacity">
                    🔍 タップで拡大表示
                  </span>
                </div>
                {(currentTherapist.isRookie || currentTherapist.badge) && (
                  <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
                    {currentTherapist.isRookie && (
                      <span className="text-white font-bold text-[10px] px-3 py-1 rounded-full shadow-sm tracking-wider bg-gradient-to-r from-pink-500 to-rose-500">
                        ♥ 新人
                      </span>
                    )}
                    {currentTherapist.badge && (
                      <span className={`text-white font-bold text-[10px] px-3 py-1 rounded-full shadow-sm tracking-wider ${
                        isCyberTheme ? 'neon-badge-pink' : 'bg-[#d1b464] text-stone-950'
                      }`}>
                        {currentTherapist.badge}
                      </span>
                    )}
                  </div>
                )}
                {(currentTherapist.rankName || currentTherapist.grade) && (
                  <span className={`absolute top-3 right-3 bg-stone-900/80 border font-semibold text-[10px] px-2.5 py-1 rounded-full tracking-wider ${
                    isCyberTheme ? 'text-[#ffa8d8] border-[#ff6fb5]' : 'text-[#d1b464] border-[#d1b464]/40'
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
                        className={`relative aspect-square rounded-lg overflow-hidden border cursor-pointer transition-all ${
                          selectedPhotoIndex === idx
                            ? isCyberTheme ? 'border-[#ff6fb5] ring-2 ring-[#ff6fb5]/50 opacity-100 scale-105' : 'border-[#d1b464] ring-2 ring-[#d1b464]/50 opacity-100 scale-105'
                            : 'border-stone-200 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <Image
                          src={img}
                          alt={`${currentTherapist.name}-${idx + 1}`}
                          fill
                          sizes="120px"
                          className="object-cover"
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
                    <span className={`text-xs ${isCyberTheme ? 'text-[#ffa8d8]' : 'text-stone-400'}`}>({currentTherapist.nameKana})</span>
                  )}
                  <span className={`text-sm font-semibold ${isCyberTheme ? 'text-[#ffa8d8]' : 'text-[#a39573]'}`}>({currentTherapist.age}歳)</span>
                </div>

                {/* サイズ情報（T / B / W / H） */}
                <div className={`text-xs font-semibold tracking-wide mt-2 space-y-1 p-3 rounded-xl border ${
                  isCyberTheme
                    ? 'bg-white/10 text-[#ded1ee] border-[#ff6fb5]/30'
                    : 'bg-[#faf7f0] text-stone-600 border-[#d1b464]/20'
                }`}>
                  <p>
                    <span className={isCyberTheme ? 'text-[#ffa8d8] font-bold' : 'text-[#a39573] font-bold'}>身長:</span> T{currentTherapist.height}cm &nbsp;|&nbsp;{' '}
                    <span className={isCyberTheme ? 'text-[#ffa8d8] font-bold' : 'text-[#a39573] font-bold'}>バスト:</span> {currentTherapist.bustCup}カップ
                    {currentTherapist.bust && ` (${currentTherapist.bust}cm)`}
                  </p>
                  {(currentTherapist.waist || currentTherapist.hip) && (
                    <p>
                      {currentTherapist.waist && <><span className={isCyberTheme ? 'text-[#ffa8d8] font-bold' : 'text-[#a39573] font-bold'}>ウエスト:</span> W{currentTherapist.waist}cm &nbsp;|&nbsp; </>}
                      {currentTherapist.hip && <><span className={isCyberTheme ? 'text-[#ffa8d8] font-bold' : 'text-[#a39573] font-bold'}>ヒップ:</span> H{currentTherapist.hip}cm</>}
                    </p>
                  )}
                  {currentTherapist.threeSize && (
                    <p className={`text-[11px] ${isCyberTheme ? 'text-[#ffa8d8]/80' : 'text-stone-500'}`}>{currentTherapist.threeSize}</p>
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
                        ? 'bg-white/8 text-[#c4b2dc] border-[#ff6fb5]/40 rounded-full'
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
                  ? 'bg-white/10 border-[#ff6fb5]/30 rounded-xl'
                  : 'bg-[#faf7f0] border-[#d1b464]/20 rounded-sm'
              }`}>
                <h3 className={`text-xs font-bold tracking-widest uppercase ${
                  isCyberTheme ? 'neon-text-pink' : 'text-[#a39573]'
                }`}>
                  自己PR / MESSAGE
                </h3>
                <p className={`text-xs sm:text-sm leading-relaxed italic tracking-wider whitespace-pre-wrap ${
                  isCyberTheme ? 'text-[#ded1ee]' : 'text-stone-700'
                }`}>
                  {currentTherapist.comment ? `"${currentTherapist.comment}"` : '心からの癒やしをご提供いたします。'}
                </p>
              </div>

              {/* 本日の出勤状況 */}
              <div className={`p-4 border space-y-2 ${
                isCyberTheme
                  ? 'bg-white/10 border-[#ff6fb5]/30 rounded-xl'
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
                      <span className={`text-xs font-bold ${isCyberTheme ? 'text-[#f4eefa]' : 'text-stone-800'}`}>
                        {todayShift.startTime} ～ {todayShift.endTime}
                        {todayShift.roomName && ` (${todayShift.roomName})`}
                      </span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium tracking-wider text-white ${
                        isCyberTheme ? 'bg-[#ff6fb5] shadow-[0_0_10px_rgba(255,111,181,0.5)]' : 'bg-[#d1b464]'
                      }`}>
                        出勤中 / 確定
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={`text-xs ${isCyberTheme ? 'text-[#ffa8d8]/70' : 'text-stone-500'}`}>本日はお休み、または調整中です</span>
                      <Link
                        href={`/${shopSlug}/schedule`}
                        className={`text-xs font-bold underline ${isCyberTheme ? 'text-[#ffa8d8]' : 'text-[#a39573]'}`}
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
                  href={`/reserve/${shopSlug}?therapist_id=${currentTherapist.id}`}
                  className={`block w-full py-4 text-center text-white font-bold text-sm tracking-widest transition-all ${
                    isCyberTheme
                      ? 'rounded-full neon-glow-btn bg-gradient-to-r from-[#ff6fb5] via-[#ff9fdd] to-[#cf82d8]'
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
                        ? 'cyber-card reveal rounded-xl border-[#ff6fb5]/30 hover:border-[#ff6fb5]'
                        : 'bg-[#faf7f0] rounded-sm border-[#d1b464]/20 hover:border-[#a39573]'
                    }`}
                  >
                    {b.eyeCatchUrl && (
                      <Image
                        src={b.eyeCatchUrl}
                        alt={b.title}
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-md object-cover border border-stone-200 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[10px] ${isCyberTheme ? 'text-[#ffa8d8]' : 'text-stone-400'}`}>{b.publishedAt}</p>
                      <h4 className={`text-xs font-bold line-clamp-1 ${isCyberTheme ? 'text-[#f4eefa]' : 'text-stone-800'}`}>{b.title}</h4>
                      <p className={`text-[11px] line-clamp-2 mt-0.5 ${isCyberTheme ? 'text-[#ded1ee]/80' : 'text-stone-600'}`}>{b.content}</p>
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
};

