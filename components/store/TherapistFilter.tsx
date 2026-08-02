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
    <div className="flex flex-wrap items-center justify-center gap-2 py-4">
      <button
        onClick={() => onSelectTag(null)}
        className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
          selectedTag === null
            ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-lg shadow-rose-600/30'
            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
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
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
              isSelected
                ? 'bg-rose-600/90 border-rose-500 text-white shadow-md shadow-rose-600/30'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            #{tag}
          </button>
        );
      })}
    </div>
  );
};
