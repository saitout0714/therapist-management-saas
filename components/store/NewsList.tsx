import React from 'react';
import { NewsItem } from '../../types/store';

interface NewsListProps {
  news: NewsItem[];
}

export const NewsList: React.FC<NewsListProps> = ({ news }) => {
  return (
    <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-4 sm:p-6 divide-y divide-slate-800">
      {news.map((item) => (
        <div key={item.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[10px] font-bold bg-slate-800 text-rose-300 px-2 py-0.5 rounded border border-rose-500/20">
              {item.category || 'お知らせ'}
            </span>
            <span className="text-[11px] text-slate-500">{item.date}</span>
          </div>
          <h4 className="text-sm font-bold text-slate-200 mb-1">{item.title}</h4>
          <p className="text-xs text-slate-400 leading-relaxed">{item.content}</p>
        </div>
      ))}
    </div>
  );
};
