import React from 'react';
import { NewsItem } from '../../types/store';

interface NewsListProps {
  news: NewsItem[];
}

export const NewsList: React.FC<NewsListProps> = ({ news }) => {
  return (
    <div className="bg-white rounded-sm border border-[#d1b464]/30 p-4 sm:p-6 divide-y divide-stone-100 font-serif shadow-sm">
      {news.map((item) => (
        <div key={item.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[10px] font-bold bg-[#faf7f0] text-[#a39573] border border-[#d1b464]/30 px-2 py-0.5 rounded-sm">
              {item.category || 'お知らせ'}
            </span>
            <span className="text-[11px] text-stone-400">{item.date}</span>
          </div>
          <h4 className="text-xs font-bold text-stone-800 mb-1">{item.title}</h4>
          <p className="text-[11px] text-stone-600 leading-relaxed">{item.content}</p>
        </div>
      ))}
    </div>
  );
};
