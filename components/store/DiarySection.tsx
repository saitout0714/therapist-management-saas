import React from 'react';
import Link from 'next/link';
import { BlogArticle } from '../../types/store';

interface DiarySectionProps {
  articles: BlogArticle[];
  storeSlug: string;
}

export const DiarySection: React.FC<DiarySectionProps> = ({ articles, storeSlug }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-serif">
      {articles.map((art) => (
        <Link
          key={art.id}
          href={`/${storeSlug}/diary/${art.id}`}
          className="group bg-white rounded-sm border border-[#d1b464]/30 p-3.5 hover:border-[#a39573] transition-all flex gap-3 shadow-sm"
        >
          {art.eyeCatchUrl ? (
            <img
              src={art.eyeCatchUrl}
              alt={art.title}
              className="w-20 h-20 rounded-sm object-cover border border-stone-200 group-hover:scale-105 transition-transform"
            />
          ) : (
            <img
              src={art.therapistAvatar}
              alt={art.therapistName}
              className="w-20 h-20 rounded-sm object-cover border border-stone-200 group-hover:scale-105 transition-transform"
            />
          )}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <img
                  src={art.therapistAvatar}
                  alt={art.therapistName}
                  className="w-4 h-4 rounded-full object-cover"
                />
                <span className="text-xs font-bold text-stone-800">{art.therapistName}</span>
                <span className="text-[10px] text-stone-400 ml-auto">{art.publishedAt}</span>
              </div>
              <h4 className="text-xs font-bold text-stone-800 group-hover:text-[#a39573] transition-colors line-clamp-2 leading-snug">
                {art.title}
              </h4>
            </div>
            <p className="text-[11px] text-stone-500 line-clamp-1 mt-1">{art.content}</p>
          </div>
        </Link>
      ))}
    </div>
  );
};
