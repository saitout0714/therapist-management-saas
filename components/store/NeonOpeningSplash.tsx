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
    <div className="fixed inset-0 z-50 bg-[#050014] flex flex-col items-center justify-center pointer-events-none transition-opacity duration-700">
      <div className="text-center space-y-3 animate-glitch-intro px-4">
        <div className="text-4xl sm:text-6xl font-extrabold tracking-widest text-[#ff007f] drop-shadow-[0_0_35px_#ff007f]">
          🐾 {storeName} 🐾
        </div>
        <p className="text-xs sm:text-sm font-bold text-pink-200 tracking-widest animate-pulse">
          〜 GRAND OPENING CYBER SPA 〜
        </p>
      </div>
    </div>
  );
};
