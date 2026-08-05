'use client';

import React from 'react';

interface TherapistFilterProps {
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  isCyber?: boolean;
}

export const TherapistFilter: React.FC<TherapistFilterProps> = ({
  tags,
  selectedTag,
  onSelectTag,
  isCyber = false,
}) => {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 py-4 ${isCyber ? 'font-sans' : 'font-serif'}`}>
      <button
        onClick={() => onSelectTag(null)}
        className={`px-4 py-1.5 text-xs font-bold transition-all ${
          isCyber
            ? selectedTag === null
              ? 'bg-[#ff007f] text-white shadow-[0_0_12px_rgba(255,0,127,0.6)] rounded-full'
              : 'bg-[#050014]/90 border border-[#ff007f]/40 text-pink-100 hover:border-[#ff007f] rounded-full'
            : selectedTag === null
              ? 'bg-[#a39573] text-white shadow-sm'
              : 'bg-white border border-[#d1b464]/30 text-stone-600 hover:border-[#a39573]'
        }`}
      >
        すべてを表示
      </button>

      {tags.map((tag) => {
        const isSelected = selectedTag === tag;
        return (
          <button
            key={tag}
            onClick={() => onSelectTag(isSelected ? null : tag)}
            className={`px-3 py-1.5 text-xs font-medium border transition-all ${
              isCyber
                ? isSelected
                  ? 'bg-[#ff007f] border-[#ff007f] text-white shadow-[0_0_12px_rgba(255,0,127,0.6)] rounded-full font-bold'
                  : 'bg-[#050014]/90 border-[#ff007f]/30 text-pink-200 hover:border-[#ff007f] rounded-full'
                : isSelected
                  ? 'bg-[#a39573] border-[#a39573] text-white shadow-sm font-bold'
                  : 'bg-white border-[#d1b464]/30 text-stone-600 hover:border-[#a39573]'
            }`}
          >
            #{tag}
          </button>
        );
      })}
    </div>
  );
};
