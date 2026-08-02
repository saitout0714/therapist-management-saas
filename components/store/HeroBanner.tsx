'use client';

import React from 'react';
import { Campaign } from '../../types/store';

interface HeroBannerProps {
  campaigns: Campaign[];
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ campaigns }) => {
  if (!campaigns || campaigns.length === 0) return null;

  return (
    <section className="relative overflow-hidden bg-slate-950 py-6 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {campaigns.map((camp) => (
            <div
              key={camp.id}
              className="group relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/60 shadow-xl hover:border-rose-500/40 transition-all duration-300"
            >
              <div className="aspect-[16/9] w-full relative overflow-hidden">
                <img
                  src={camp.imageUrl}
                  alt={camp.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                {camp.badgeText && (
                  <span className="absolute top-3 left-3 bg-gradient-to-r from-rose-600 to-pink-600 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-lg">
                    {camp.badgeText}
                  </span>
                )}
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-base sm:text-lg font-bold text-white mb-1 group-hover:text-rose-300 transition-colors">
                    {camp.title}
                  </h3>
                  {camp.description && (
                    <p className="text-xs text-slate-300 line-clamp-2">{camp.description}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
