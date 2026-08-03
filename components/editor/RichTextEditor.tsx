'use client';

import React, { useState, useRef } from 'react';
import { uploadBlogImage } from '../../lib/storage';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder = 'ブログの本文を入力してください...' }: RichTextEditorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormat = (tagStart: string, tagEnd: string = '') => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selectedText = el.value.substring(start, end);
    const replacement = `${tagStart}${selectedText || 'テキスト'}${tagEnd}`;
    const newValue = el.value.substring(0, start) + replacement + el.value.substring(end);
    onChange(newValue);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + tagStart.length, start + tagStart.length + (selectedText ? selectedText.length : 4));
    }, 50);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const imageUrl = await uploadBlogImage(file);
      const imageTag = `\n<img src="${imageUrl}" alt="Uploaded image" className="max-w-full h-auto rounded-sm my-4 border border-stone-200" />\n`;
      
      if (textareaRef.current) {
        const el = textareaRef.current;
        const start = el.selectionStart;
        const newValue = el.value.substring(0, start) + imageTag + el.value.substring(start);
        onChange(newValue);
      } else {
        onChange(value + imageTag);
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
      alert('画像のアップロードに失敗しました。');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="border border-[#d1b464]/40 rounded-sm bg-white overflow-hidden shadow-sm font-serif">
      {/* ツールバー */}
      <div className="flex flex-wrap items-center justify-between gap-1 p-2 bg-[#faf7f0] border-b border-[#d1b464]/30 text-xs">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => applyFormat('<strong>', '</strong>')}
            className="px-2.5 py-1 font-bold bg-white border border-stone-300 rounded-sm hover:bg-[#a39573] hover:text-white transition-colors"
            title="太字"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => applyFormat('<em>', '</em>')}
            className="px-2.5 py-1 italic font-serif bg-white border border-stone-300 rounded-sm hover:bg-[#a39573] hover:text-white transition-colors"
            title="斜体"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => applyFormat('<h2>', '</h2>')}
            className="px-2.5 py-1 font-extrabold bg-white border border-stone-300 rounded-sm hover:bg-[#a39573] hover:text-white transition-colors"
            title="見出し2"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => applyFormat('<h3>', '</h3>')}
            className="px-2.5 py-1 font-bold bg-white border border-stone-300 rounded-sm hover:bg-[#a39573] hover:text-white transition-colors"
            title="見出し3"
          >
            H3
          </button>
          <button
            type="button"
            onClick={() => applyFormat('<blockquote>', '</blockquote>')}
            className="px-2.5 py-1 bg-white border border-stone-300 rounded-sm hover:bg-[#a39573] hover:text-white transition-colors"
            title="引用"
          >
            ” 引用
          </button>
          <button
            type="button"
            onClick={() => applyFormat('<hr />')}
            className="px-2.5 py-1 bg-white border border-stone-300 rounded-sm hover:bg-[#a39573] hover:text-white transition-colors"
            title="区切り線"
          >
            ―
          </button>

          {/* 画像アップロードボタン */}
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1 bg-stone-900 text-white font-bold rounded-sm hover:bg-stone-800 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {isUploading ? 'アップロード中...' : '📷 画像追加'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        {/* プレビュー切り替え */}
        <div>
          <button
            type="button"
            onClick={() => setIsPreview(!isPreview)}
            className={`px-3 py-1 font-semibold rounded-sm border transition-colors ${
              isPreview
                ? 'bg-[#a39573] text-white border-[#a39573]'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
            }`}
          >
            {isPreview ? '✏️ 編集モード' : '👁️ プレビュー'}
          </button>
        </div>
      </div>

      {/* エディタ本文入力エリア */}
      {isPreview ? (
        <div className="p-4 min-h-[250px] bg-[#faf9f5] text-xs sm:text-sm text-stone-800 leading-relaxed space-y-4 tracking-wide border-t border-stone-100">
          {value ? (
            <div dangerouslySetInnerHTML={{ __html: value }} />
          ) : (
            <p className="text-stone-400 italic">（プレビュー内容がありません）</p>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full min-h-[280px] p-4 text-xs sm:text-sm text-stone-800 bg-white focus:outline-none leading-relaxed font-sans"
        />
      )}
    </div>
  );
}
