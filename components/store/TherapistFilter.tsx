'use client';

import React from 'react';

interface TherapistFilterProps {
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

export const TherapistFilter: React.FC<TherapistFilterProps> = ({
  tags,
  selectedTag,
  onSelectTag,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-4 font-serif">
      <button
        onClick={() => onSelectTag(null)}
        className={`px-4 py-1.5 text-xs font-bold transition-all ${
          selectedTag === null
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
              isSelected
                ? 'bg-[#a39573] border-[#a39573] text-white shadow-sm'
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
