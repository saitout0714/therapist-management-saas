'use client';

import React from 'react';

interface ImageLightboxModalProps {
  isOpen: boolean;
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onSelectIndex: (idx: number) => void;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  images,
  currentIndex,
  onClose,
  onSelectIndex,
}) => {
  if (!isOpen || !images || images.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/95 backdrop-blur-md flex flex-col items-center justify-between p-4 font-serif animate-fadeIn">
      {/* 閉じるボタン */}
      <div className="w-full max-w-5xl flex justify-end pt-2">
        <button
          onClick={onClose}
          className="p-2.5 bg-stone-900/80 hover:bg-stone-800 text-stone-300 hover:text-white rounded-full border border-stone-700 transition-colors"
          aria-label="閉じる"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* メイン画像表示 */}
      <div className="relative flex-1 w-full max-w-4xl flex items-center justify-center p-2">
        <img
          src={images[currentIndex]}
          alt="Lightbox Preview"
          className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl border border-stone-800"
        />

        {images.length > 1 && (
          <>
            <button
              onClick={() => onSelectIndex(currentIndex === 0 ? images.length - 1 : currentIndex - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-3 bg-stone-900/80 hover:bg-[#d1b464] text-white hover:text-stone-950 rounded-full border border-stone-700 transition-all backdrop-blur-sm"
            >
              ❮
            </button>
            <button
              onClick={() => onSelectIndex((currentIndex + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-stone-900/80 hover:bg-[#d1b464] text-white hover:text-stone-950 rounded-full border border-stone-700 transition-all backdrop-blur-sm"
            >
              ❯
            </button>
          </>
        )}
      </div>

      {/* サムネイルバー */}
      {images.length > 1 && (
        <div className="w-full max-w-2xl overflow-x-auto pb-2 flex justify-center gap-2">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => onSelectIndex(idx)}
              className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                idx === currentIndex ? 'border-[#d1b464] scale-105' : 'border-stone-800 opacity-50 hover:opacity-100'
              }`}
            >
              <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
