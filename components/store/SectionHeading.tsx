'use client';

import React from 'react';
import { useInViewOnce } from './useInViewOnce';

interface SectionHeadingProps {
  /** 英字の見出し（Therapist / Diary など）。ネオンテーマでは筆記体アクセントになる */
  title: string;
  /** 日本語のセクション名 */
  subtitle: string;
  /** サイバーネオンテーマかどうか */
  isCyber?: boolean;
  /** 見出しの寄せ。既定は中央 */
  align?: 'center' | 'left';
  /** 見出しの大きさ。サイドカラム用に小さくしたい時は sm */
  size?: 'md' | 'sm';
  className?: string;
}

/**
 * 見出しの点灯演出用のクラス名を組み立てる。
 * JSが動く前（mounted=false）は何も付けないので、
 * JavaScript が無効でも見出しが消えることはない。
 */
function flickerClass(mounted: boolean, inView: boolean) {
  if (!mounted) return '';
  return inView ? 'neon-flicker-in' : 'neon-flicker-pending';
}

/**
 * 店舗ページ共通のセクション見出し。
 * ネオンテーマでは「筆記体の英字アクセント → 発光する日本語見出し → グラデーション罫線」の3段構成。
 * 画面に入ると見出しがネオン管のように点灯し、罫線が左から右へ伸びる。
 * 非ネオンの店舗は従来どおりの明朝＋細罫線のまま。
 */
export const SectionHeading: React.FC<SectionHeadingProps> = ({
  title,
  subtitle,
  isCyber = false,
  align = 'center',
  size = 'md',
  className = '',
}) => {
  const { ref, inView, mounted } = useInViewOnce<HTMLDivElement>();

  if (!isCyber) {
    return (
      <div className={`${align === 'center' ? 'text-center' : 'text-left'} ${className}`}>
        <h2 className={`${size === 'md' ? 'text-2xl' : 'text-xl'} font-bold tracking-widest text-stone-800`}>{title}</h2>
        <span className="inline-block text-xs border-t px-4 pt-1 mt-1 tracking-widest text-[#a39573] border-stone-800">
          {subtitle}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`flex flex-col ${align === 'center' ? 'items-center text-center' : 'items-start text-left'} ${className}`}
    >
      <span
        className={`neon-script leading-tight pb-1.5 ${size === 'md' ? 'text-4xl sm:text-5xl' : 'text-3xl'}`}
        aria-hidden="true"
      >
        {title}
      </span>
      <h2
        className={`font-cyber-display font-extrabold neon-text-pink mt-1 ${
          size === 'md' ? 'text-lg sm:text-xl' : 'text-base'
        } ${flickerClass(mounted, inView)}`}
      >
        {subtitle}
      </h2>
      <div
        className={`neon-rule neon-rule-draw mt-3 ${size === 'md' ? 'w-44' : 'w-28'} ${inView ? 'is-in' : ''}`}
      />
    </div>
  );
};

/**
 * 下層ページのタイトル。SectionHeading と同じ見た目で、見出しレベルだけ h1 にする。
 */
export const PageHeading: React.FC<Omit<SectionHeadingProps, 'align' | 'size'>> = ({
  title,
  subtitle,
  isCyber = false,
  className = '',
}) => {
  const { ref, inView, mounted } = useInViewOnce<HTMLDivElement>();

  if (!isCyber) {
    return (
      <div className={`text-center ${className}`}>
        <h1 className="text-2xl font-bold tracking-widest text-stone-800">{title}</h1>
        <span className="inline-block text-xs border-t px-4 pt-1 mt-1 tracking-widest text-[#a39573] border-stone-800">
          {subtitle}
        </span>
      </div>
    );
  }

  return (
    <div ref={ref} className={`flex flex-col items-center text-center ${className}`}>
      <span className="neon-script leading-tight pb-1.5 text-4xl sm:text-5xl" aria-hidden="true">
        {title}
      </span>
      <h1
        className={`font-cyber-display font-extrabold neon-text-pink mt-1 text-lg sm:text-xl ${flickerClass(mounted, inView)}`}
      >
        {subtitle}
      </h1>
      <div className={`neon-rule neon-rule-draw mt-3 w-44 ${inView ? 'is-in' : ''}`} />
    </div>
  );
};
