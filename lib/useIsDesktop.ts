'use client';

import { useEffect, useState } from 'react';

/**
 * デスクトップ幅（Tailwind の sm: 以上 = 640px 以上）かどうかを返す。
 * SSR / 初回レンダリング時は false（＝スマホ扱い）なので、
 * スマホ表示のレイアウトを一切変えずにデスクトップだけ調整したい箇所で使う。
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 640px)');
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return isDesktop;
}
