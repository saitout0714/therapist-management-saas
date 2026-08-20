'use client';

import React, { useEffect } from 'react';

/**
 * ラグジュアリーテーマ(specialgrade)の背景演出。
 *
 * やっていることは2つだけ。
 *  1) スクロール量を CSS 変数 (--lux-scroll / --lux-tint / --lux-tint-2) に流し込む。
 *     背景クラス側 (globals.css の --luxury-tint-wash) がこの色を薄く重ねているので、
 *     読み進めるほどページ全体のトーンがローズ→ゴールド→ライラックへと移ろう。
 *  2) 光のカーテンと金粉の粒子を固定レイヤーで重ねる。
 *
 * 色の計算だけ JS で行い、描画は CSS 変数任せにしているので
 * スクロール中に React の再レンダリングは一切発生しない。
 */

/** スクロール 0→1 に沿って巡回する背景トーン（すべて既存パレットの範囲内） */
const TINT_STOPS: ReadonlyArray<readonly [number, number, number]> = [
  [226, 179, 177], // ダスティローズ
  [212, 175, 55], // シャンパンゴールド
  [198, 149, 162], // ローズピンク
  [205, 173, 150], // ウォームベージュ
  [214, 186, 196], // ライラックローズ
];

const tintAt = (progress: number): [number, number, number] => {
  const span = TINT_STOPS.length - 1;
  const pos = Math.min(Math.max(progress, 0), 1) * span;
  const i = Math.min(Math.floor(pos), span - 1);
  const t = pos - i;
  const from = TINT_STOPS[i];
  const to = TINT_STOPS[i + 1];
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
  ];
};

/** 金粉の粒子。位置・大きさ・速度は固定値（乱数だとSSRとクライアントで食い違うため） */
const MOTES = [
  { left: '6%', size: 5, duration: 21, delay: 0, parallax: -40 },
  { left: '17%', size: 3, duration: 27, delay: 6, parallax: -70 },
  { left: '28%', size: 6, duration: 24, delay: 12, parallax: -28 },
  { left: '39%', size: 4, duration: 30, delay: 3, parallax: -55 },
  { left: '48%', size: 3, duration: 19, delay: 15, parallax: -80 },
  { left: '58%', size: 5, duration: 26, delay: 9, parallax: -35 },
  { left: '67%', size: 4, duration: 22, delay: 18, parallax: -62 },
  { left: '78%', size: 6, duration: 29, delay: 2, parallax: -30 },
  { left: '87%', size: 3, duration: 23, delay: 11, parallax: -75 },
  { left: '95%', size: 4, duration: 31, delay: 7, parallax: -48 },
] as const;

export const LuxuryAmbientBackground: React.FC = () => {
  useEffect(() => {
    const root = document.documentElement;
    let ticking = false;

    const apply = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;

      const [r, g, b] = tintAt(progress);
      // 2色目は少しずらした位置の色を使い、常に2トーンの光が混ざるようにする
      const [r2, g2, b2] = tintAt((progress + 0.42) % 1);

      root.style.setProperty('--lux-scroll', progress.toFixed(4));
      root.style.setProperty('--lux-tint', `${r}, ${g}, ${b}`);
      root.style.setProperty('--lux-tint-2', `${r2}, ${g2}, ${b2}`);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    apply();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      // 他テーマのページへ遷移したときに色が残らないよう戻す
      root.style.removeProperty('--lux-scroll');
      root.style.removeProperty('--lux-tint');
      root.style.removeProperty('--lux-tint-2');
    };
  }, []);

  return (
    <div className="luxury-ambient" aria-hidden="true">
      <div className="luxury-aurora" />
      <div className="luxury-sheen" />
      {MOTES.map((mote, idx) => (
        <div
          key={idx}
          className="luxury-mote"
          style={
            {
              left: mote.left,
              '--mote-size': `${mote.size}px`,
              '--mote-duration': `${mote.duration}s`,
              '--mote-delay': `-${mote.delay}s`,
              '--mote-parallax': `${mote.parallax}px`,
            } as React.CSSProperties
          }
        >
          <span />
        </div>
      ))}
      <div className="luxury-vignette" />
    </div>
  );
};
