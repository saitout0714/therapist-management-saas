'use client';

import React, { useState, useEffect } from 'react';

interface NeonOpeningSplashProps {
  storeSlug: string;
  storeName: string;
}

export const NeonOpeningSplash: React.FC<NeonOpeningSplashProps> = ({ storeSlug, storeName }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // 1.5秒後にスッとフェードアウト
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible || storeSlug !== 'onyankospa') return null;

  return (
    <div className="fixed inset-0 z-50 cyber-bg flex flex-col items-center justify-center pointer-events-none transition-opacity duration-700">
      <div className="text-center space-y-3 animate-glitch-intro px-4">
        <span className="neon-script block text-3xl sm:text-5xl leading-tight pb-1" aria-hidden="true">
          Onyanko Spa
        </span>
        <div className="font-cyber-display text-4xl sm:text-6xl font-extrabold tracking-widest neon-text-pink">
          🐾 {storeName} 🐾
        </div>
        <div className="neon-rule w-56 mx-auto" />
        <p className="text-xs sm:text-sm font-bold text-[#ffa8d8] tracking-[0.3em] animate-pulse">
          〜 GRAND OPENING NEON SPA 〜
        </p>
      </div>
    </div>
  );
};
