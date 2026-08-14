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
              ? 'bg-[#ff6fb5] neon-on-pink shadow-[0_0_12px_rgba(255,111,181,0.6)] rounded-full'
              : 'bg-white/10 border border-[#ff6fb5]/40 text-[#ded1ee] hover:border-[#ff6fb5] rounded-full'
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
                  ? 'bg-[#ff6fb5] border-[#ff6fb5] neon-on-pink shadow-[0_0_12px_rgba(255,111,181,0.6)] rounded-full font-bold'
                  : 'bg-white/10 border-[#ff6fb5]/30 text-[#c4b2dc] hover:border-[#ff6fb5] rounded-full'
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
