import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { NewsItem } from '../../types/store';

interface NewsListProps {
  news: NewsItem[];
  storeSlug?: string;
  /** 記事タイトルのリンク先組み立てに使う。省略時は /{storeSlug} を使う */
  basePath?: string;
}

export const NewsList: React.FC<NewsListProps> = ({ news, storeSlug, basePath }) => {
  const isCyber = storeSlug === 'onyankospa';
  const isLuxury = storeSlug === 'specialgrade';
  const resolvedBasePath = basePath ?? `/${storeSlug}`;

  if (news.length === 0) {
    return (
      <div className={`p-6 text-center ${
        isCyber
          ? 'cyber-card reveal rounded-xl border-[#ff6fb5]/40 font-sans'
          : isLuxury
          ? 'luxury-card rounded-2xl border border-[#e2b3b1]/35 luxury-body'
          : 'bg-white rounded-sm border border-[#d1b464]/30 font-serif shadow-sm'
      }`}>
        <p className={`text-xs ${isCyber ? 'text-[#ded1ee]/60' : isLuxury ? 'text-[#8a7e7c]' : 'text-stone-400'}`}>現在お知らせはありません。</p>
      </div>
    );
  }

  return (
    <div className={`p-5 sm:p-7 divide-y ${
      isCyber
        ? 'cyber-card reveal rounded-xl border-[#ff6fb5]/40 divide-[#ff6fb5]/20 font-sans'
        : isLuxury
        ? 'luxury-card rounded-2xl sm:rounded-3xl border border-[#e2b3b1]/35 divide-[#e2b3b1]/25 luxury-body'
        : 'bg-white rounded-sm border border-[#d1b464]/30 divide-stone-100 font-serif shadow-sm'
    }`}>
      {news.map((item) => (
        <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 flex gap-4">
          {item.imageUrl && (
            <Link href={`${resolvedBasePath}/news/${item.id}`} className="shrink-0">
              <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border ${
                isCyber ? 'border-[#ff6fb5]/30' : isLuxury ? 'border-[#e2b3b1]/40' : 'border-[#d1b464]/20'
              }`}>
                <Image src={item.imageUrl} alt={item.title} fill sizes="80px" className="object-cover" />
              </div>
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 mb-1.5">
              <span className={`text-[10px] font-medium px-2.5 py-0.5 border ${
                isCyber
                  ? 'bg-[#ff6fb5]/20 text-[#ffa8d8] border-[#ff6fb5]/40 rounded-full font-bold'
                  : isLuxury
                  ? 'bg-[#fdf8f5] text-[#c5a059] border-[#e2b3b1]/50 rounded-full font-luxury-display'
                  : 'bg-[#faf7f0] text-[#a39573] border-[#d1b464]/30 rounded-sm font-bold'
              }`}>
                {item.category || 'お知らせ'}
              </span>
              <span className={`text-[11px] ${isCyber ? 'text-[#ffa8d8]' : isLuxury ? 'text-[#8a7e7c]' : 'text-stone-400'}`}>{item.date}</span>
            </div>
            <h4 className={`text-xs font-semibold mb-1 ${isCyber ? 'neon-text-pink' : isLuxury ? 'text-[#2b2827]' : 'text-stone-800'}`}>
              <Link href={`${resolvedBasePath}/news/${item.id}`} className="hover:underline">
                {item.title}
              </Link>
            </h4>
            <p className={`text-[11px] leading-relaxed line-clamp-2 ${isCyber ? 'text-[#ded1ee]' : isLuxury ? 'text-[#5c5250]' : 'text-stone-600'}`}>{item.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
