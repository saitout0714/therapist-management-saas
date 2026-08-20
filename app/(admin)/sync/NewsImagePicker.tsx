'use client'

import { useEffect, useRef, useState } from 'react'

export default function NewsImagePicker({
  image,
  onChange,
}: {
  image: File | null
  onChange: (file: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(image)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">画像（任意・1MB未満のjpg/png）</label>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/jpg"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        className="hidden"
      />

      {previewUrl ? (
        <div className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
          <img src={previewUrl} alt="選択した画像のプレビュー" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-600 truncate">{image?.name}</p>
            <div className="flex gap-3 mt-1">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                画像を変更
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-xs font-bold text-rose-600 hover:text-rose-800"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl text-sm font-bold text-slate-500 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
          クリックして画像を選択
        </button>
      )}
    </div>
  )
}
