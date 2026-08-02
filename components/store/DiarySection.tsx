import React from 'react';
import Link from 'next/link';
import { BlogArticle } from '../../types/store';

interface DiarySectionProps {
  articles: BlogArticle[];
  storeSlug: string;
}

export const DiarySection: React.FC<DiarySectionProps> = ({ articles, storeSlug }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {articles.map((art) => (
        <Link
          key={art.id}
          href={`/${storeSlug}/diary/${art.id}`}
          className="group bg-slate-900/60 rounded-2xl border border-slate-800 p-4 hover:border-rose-500/50 transition-all flex gap-4"
        >
          {art.eyeCatchUrl ? (
            <img
              src={art.eyeCatchUrl}
              alt={art.title}
              className="w-24 h-24 rounded-xl object-cover border border-slate-800 group-hover:scale-105 transition-transform"
            />
          ) : (
            <img
              src={art.therapistAvatar}
              alt={art.therapistName}
              className="w-24 h-24 rounded-xl object-cover border border-slate-800 group-hover:scale-105 transition-transform"
            />
          )}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <img
                  src={art.therapistAvatar}
                  alt={art.therapistName}
                  className="w-5 h-5 rounded-full object-cover"
                />
                <span className="text-xs font-semibold text-rose-300">{art.therapistName}</span>
                <span className="text-[10px] text-slate-500 ml-auto">{art.publishedAt}</span>
              </div>
              <h4 className="text-sm font-bold text-slate-100 group-hover:text-rose-300 transition-colors line-clamp-2">
                {art.title}
              </h4>
            </div>
            <p className="text-xs text-slate-400 line-clamp-1 mt-2">{art.content}</p>
          </div>
        </Link>
      ))}
    </div>
  );
};
