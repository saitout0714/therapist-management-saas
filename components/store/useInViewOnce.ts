'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 要素が画面に入ったかどうかを一度だけ検知する。
 *
 * ネオンの点灯や罫線の伸びのように「再生時間が決まっている演出」用。
 * スクロール量に追従させる演出（ぼけ→くっきり）は CSS の
 * animation-timeline 側で処理しているので、こちらは使わない。
 *
 * SSR時と JS が動く前は inView=false / mounted=false を返す。
 * 呼び出し側は mounted が true になるまで要素を隠さないことで、
 * JavaScript が無効な環境でもコンテンツが消えないようにしている。
 */
export function useInViewOnce<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const el = ref.current;
    if (!el) return;

    // 古い環境や、視差効果を減らす設定の端末では演出せず即表示する
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, inView, mounted };
}
