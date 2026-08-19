'use client';

import React from 'react';

interface SpecialGradeLogoProps {
  variant?: 'horizontal' | 'vertical' | 'mark-only' | 'misshelly';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  theme?: 'dark' | 'light' | 'gold';
}

export const SpecialGradeLogo: React.FC<SpecialGradeLogoProps> = ({
  variant = 'misshelly',
  size = 'md',
  className = '',
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const isGold = theme === 'gold';

  const textColor = isLight ? '#ffffff' : isGold ? '#c5a059' : '#2b2827';
  const subTextColor = isLight ? '#f5efe8' : '#c5a059';
  const strokeColor = isLight ? '#ffffff' : isGold ? '#d4af37' : '#c5a059';

  // モノグラムマーク SVG (misshelly風の繊細なリング＆SGクレスト)
  const MonogramMark = (
    <div className={`relative flex items-center justify-center ${
      size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6'
    } transition-transform duration-500 group-hover:scale-105`}>
      <svg viewBox="0 0 60 60" fill="none" className="w-full h-full">
        {/* 外側オーバルリング */}
        <ellipse
          cx="30"
          cy="30"
          rx="25"
          ry="27"
          stroke={strokeColor}
          strokeWidth="1.2"
          strokeDasharray="2 1.5"
          opacity="0.65"
        />
        <ellipse
          cx="30"
          cy="30"
          rx="22"
          ry="24"
          stroke={strokeColor}
          strokeWidth="0.8"
        />
        
        {/* S & G インターロッキング文字 */}
        <text
          x="26"
          y="37"
          textAnchor="middle"
          fill={textColor}
          style={{
            fontFamily: 'var(--font-luxury-serif), "Noto Serif JP", serif',
            fontSize: '22px',
            fontStyle: 'italic',
            fontWeight: 500,
          }}
        >
          S
        </text>
        <text
          x="35"
          y="39"
          textAnchor="middle"
          fill={strokeColor}
          style={{
            fontFamily: 'var(--font-luxury-serif), "Noto Serif JP", serif',
            fontSize: '18px',
            fontWeight: 400,
          }}
        >
          G
        </text>
      </svg>
    </div>
  );

  if (variant === 'mark-only') {
    return <div className={`inline-flex items-center ${className}`}>{MonogramMark}</div>;
  }

  // misshelly 完全準拠 (中央揃え: 上にSGエンブレム、下にエレガントなセリフロゴ)
  if (variant === 'misshelly' || variant === 'vertical') {
    return (
      <div className={`flex flex-col items-center justify-center text-center group cursor-pointer leading-none gap-0.5 ${className}`}>
        {MonogramMark}
        <span
          className={`font-luxury-display italic tracking-[0.14em] transition-colors ${
            size === 'sm' ? 'text-sm sm:text-base' : size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-base sm:text-lg'
          }`}
          style={{ color: textColor }}
        >
          Special Grade
        </span>
      </div>
    );
  }

  // 横並び（Horizontal）
  return (
    <div className={`flex items-center gap-2.5 group cursor-pointer ${className}`}>
      {MonogramMark}
      <div className="flex flex-col leading-tight text-left">
        <span
          className={`font-luxury-display italic tracking-[0.12em] transition-all duration-400 group-hover:text-[#c5a059] ${
            size === 'sm' ? 'text-sm sm:text-base' : size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-base sm:text-lg'
          }`}
          style={{ color: textColor }}
        >
          Special Grade
        </span>
        <span
          className="text-[8px] sm:text-[9px] font-medium tracking-[0.24em] uppercase"
          style={{ color: subTextColor }}
        >
          Mens Esthetic & Cosmetic
        </span>
      </div>
    </div>
  );
};
