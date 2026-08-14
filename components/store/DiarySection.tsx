import React from 'react';
import Link from 'next/link';
import { BlogArticle } from '../../types/store';

interface DiarySectionProps {
  articles: BlogArticle[];
  storeSlug: string;
}

export const DiarySection: React.FC<DiarySectionProps> = ({ articles, storeSlug }) => {
  const isCyber = storeSlug === 'onyankospa';

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${isCyber ? 'font-sans' : 'font-serif'}`}>
      {articles.map((art) => (
        <Link
          key={art.id}
          href={`/${storeSlug}/diary/${art.id}`}
          className={`group p-3.5 transition-all flex gap-3 ${
            isCyber
              ? 'cyber-card reveal rounded-xl border-[#ff6fb5]/30 hover:border-[#ff6fb5]'
              : 'bg-white rounded-sm border border-[#d1b464]/30 hover:border-[#a39573] shadow-sm'
          }`}
        >
          {art.eyeCatchUrl ? (
            <img
              src={art.eyeCatchUrl}
              alt={art.title}
              className="w-20 h-20 rounded-lg object-cover border border-stone-200 group-hover:scale-105 transition-transform"
            />
          ) : (
            <img
              src={art.therapistAvatar}
              alt={art.therapistName}
              className="w-20 h-20 rounded-lg object-cover border border-stone-200 group-hover:scale-105 transition-transform"
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
                <span className={`text-xs font-bold ${isCyber ? 'text-[#ded1ee]' : 'text-stone-800'}`}>{art.therapistName}</span>
                <span className={`text-[10px] ml-auto ${isCyber ? 'text-[#ffa8d8]' : 'text-stone-400'}`}>{art.publishedAt}</span>
              </div>
              <h4 className={`text-xs font-bold group-hover:text-[#ffa8d8] transition-colors line-clamp-2 leading-snug ${
                isCyber ? 'text-[#f4eefa]' : 'text-stone-800'
              }`}>
                {art.title}
              </h4>
            </div>
            <p className={`text-[11px] line-clamp-1 mt-1 ${isCyber ? 'text-[#c4b2dc]/80' : 'text-stone-500'}`}>{art.content}</p>
          </div>
        </Link>
      ))}
    </div>
  );
};
