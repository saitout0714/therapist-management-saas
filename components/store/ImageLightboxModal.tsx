'use client';

import React from 'react';

interface ImageLightboxModalProps {
  isOpen: boolean;
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onSelectIndex: (idx: number) => void;
  isCyber?: boolean;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  images,
  currentIndex,
  onClose,
  onSelectIndex,
  isCyber = false,
}) => {
  if (!isOpen || !images || images.length === 0) return null;

  return (
    <div className={`fixed inset-0 z-50 bg-stone-950/95 backdrop-blur-md flex flex-col items-center justify-between p-4 animate-fadeIn ${
      isCyber ? 'font-sans' : 'font-serif'
    }`}>
      {/* 閉じるボタン */}
      <div className="w-full max-w-5xl flex justify-end pt-2">
        <button
          onClick={onClose}
          className={`p-2.5 rounded-full border transition-colors ${
            isCyber
              ? 'bg-[#1a0933] border-[#ff8fc9]/40 text-pink-100 hover:border-[#ff8fc9]'
              : 'bg-stone-900/80 hover:bg-stone-800 text-stone-300 hover:text-white border-stone-700'
          }`}
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
          className={`max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl border ${
            isCyber ? 'border-[#ff8fc9]/50 shadow-[0_0_25px_rgba(255,143,201,0.4)]' : 'border-stone-800'
          }`}
        />

        {images.length > 1 && (
          <>
            <button
              onClick={() => onSelectIndex(currentIndex === 0 ? images.length - 1 : currentIndex - 1)}
              className={`absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full border transition-all backdrop-blur-sm ${
                isCyber
                  ? 'bg-[#050014]/80 hover:bg-[#ff8fc9] text-white border-[#ff8fc9]/40'
                  : 'bg-stone-900/80 hover:bg-[#d1b464] text-white hover:text-stone-950 border-stone-700'
              }`}
            >
              ❮
            </button>
            <button
              onClick={() => onSelectIndex((currentIndex + 1) % images.length)}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full border transition-all backdrop-blur-sm ${
                isCyber
                  ? 'bg-[#050014]/80 hover:bg-[#ff8fc9] text-white border-[#ff8fc9]/40'
                  : 'bg-stone-900/80 hover:bg-[#d1b464] text-white hover:text-stone-950 border-stone-700'
              }`}
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
                idx === currentIndex
                  ? isCyber ? 'border-[#ff8fc9] scale-105 shadow-[0_0_10px_#ff8fc9]' : 'border-[#d1b464] scale-105'
                  : 'border-stone-800 opacity-50 hover:opacity-100'
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
