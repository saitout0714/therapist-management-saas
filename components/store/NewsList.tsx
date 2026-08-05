import React from 'react';
import { NewsItem } from '../../types/store';

interface NewsListProps {
  news: NewsItem[];
  storeSlug?: string;
}

export const NewsList: React.FC<NewsListProps> = ({ news, storeSlug }) => {
  const isCyber = storeSlug === 'onyankospa';

  return (
    <div className={`p-4 sm:p-6 divide-y ${
      isCyber
        ? 'cyber-card rounded-xl border-[#ff007f]/40 divide-[#ff007f]/20 font-sans'
        : 'bg-white rounded-sm border border-[#d1b464]/30 divide-stone-100 font-serif shadow-sm'
    }`}>
      {news.map((item) => (
        <div key={item.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-center gap-3 mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 border ${
              isCyber
                ? 'bg-[#ff007f]/20 text-pink-300 border-[#ff007f]/40 rounded-full'
                : 'bg-[#faf7f0] text-[#a39573] border-[#d1b464]/30 rounded-sm'
            }`}>
              {item.category || 'お知らせ'}
            </span>
            <span className={`text-[11px] ${isCyber ? 'text-pink-300' : 'text-stone-400'}`}>{item.date}</span>
          </div>
          <h4 className={`text-xs font-bold mb-1 ${isCyber ? 'neon-text-pink' : 'text-stone-800'}`}>{item.title}</h4>
          <p className={`text-[11px] leading-relaxed ${isCyber ? 'text-pink-100' : 'text-stone-600'}`}>{item.content}</p>
        </div>
      ))}
    </div>
  );
};
