/**
 * 店舗公開ページ共通のローディング表示。
 *
 * これらのページは headers() を使う動的レンダリングで、描画までにSupabaseへ
 * 数回問い合わせる。loading.tsx が無いとリンクを押してからサーバーが返るまで
 * 画面が一切変わらず「固まった」ように見えるため、まず骨組みだけ即座に出す。
 *
 * テーマ色は layout.tsx 側のラッパーが CSS変数 --skeleton / 背景クラスとして
 * 渡してくる（loading.tsx は params を受け取れないため）。
 */
export default function StorePublicLoading() {
  const block = 'rounded-md bg-[var(--skeleton,rgba(128,128,128,0.15))]';

  return (
    <div className="min-h-screen animate-pulse" aria-busy="true" aria-live="polite">
      <span className="sr-only">読み込み中です</span>

      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 h-16 sm:px-8">
        <div className={`${block} h-8 w-40`} />
        <div className={`${block} h-8 w-8 sm:w-64`} />
      </div>

      {/* メインビジュアル */}
      <div className={`${block} w-full aspect-[16/10] sm:aspect-[16/9] !rounded-none`} />

      {/* クイックアクション3連 */}
      <div className="max-w-5xl mx-auto my-5 grid grid-cols-3 gap-2 px-4">
        <div className={`${block} h-14`} />
        <div className={`${block} h-14`} />
        <div className={`${block} h-14`} />
      </div>

      {/* 本文ブロック */}
      <div className="max-w-7xl mx-auto px-4 py-10 space-y-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-2">
          <div className={`${block} h-7 w-52`} />
          <div className={`${block} h-3 w-28`} />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className={`${block} w-full aspect-[3/4]`} />
              <div className={`${block} h-3 w-3/4`} />
              <div className={`${block} h-3 w-1/2`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
