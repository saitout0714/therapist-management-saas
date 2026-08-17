import React from 'react';
import { NewsItem } from '../../types/store';

interface NewsListProps {
  news: NewsItem[];
  storeSlug?: string;
}

export const NewsList: React.FC<NewsListProps> = ({ news, storeSlug }) => {
  const isCyber = storeSlug === 'onyankospa';

  if (news.length === 0) {
    return (
      <div className={`p-6 text-center ${
        isCyber
          ? 'cyber-card reveal rounded-xl border-[#ff6fb5]/40 font-sans'
          : 'bg-white rounded-sm border border-[#d1b464]/30 font-serif shadow-sm'
      }`}>
        <p className={`text-xs ${isCyber ? 'text-[#ded1ee]/60' : 'text-stone-400'}`}>現在お知らせはありません。</p>
      </div>
    );
  }

  return (
    <div className={`p-4 sm:p-6 divide-y ${
      isCyber
        ? 'cyber-card reveal rounded-xl border-[#ff6fb5]/40 divide-[#ff6fb5]/20 font-sans'
        : 'bg-white rounded-sm border border-[#d1b464]/30 divide-stone-100 font-serif shadow-sm'
    }`}>
      {news.map((item) => (
        <div key={item.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-center gap-3 mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 border ${
              isCyber
                ? 'bg-[#ff6fb5]/20 text-[#ffa8d8] border-[#ff6fb5]/40 rounded-full'
                : 'bg-[#faf7f0] text-[#a39573] border-[#d1b464]/30 rounded-sm'
            }`}>
              {item.category || 'お知らせ'}
            </span>
            <span className={`text-[11px] ${isCyber ? 'text-[#ffa8d8]' : 'text-stone-400'}`}>{item.date}</span>
          </div>
          <h4 className={`text-xs font-bold mb-1 ${isCyber ? 'neon-text-pink' : 'text-stone-800'}`}>{item.title}</h4>
          <p className={`text-[11px] leading-relaxed ${isCyber ? 'text-[#ded1ee]' : 'text-stone-600'}`}>{item.content}</p>
        </div>
      ))}
    </div>
  );
};
