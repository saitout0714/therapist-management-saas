'use client'

import { useState } from 'react'
import NewsImagePicker from './NewsImagePicker'

const NEWS_TYPES: { value: string; label: string }[] = [
  { value: '1', label: '割引情報' },
  { value: '2', label: 'イベント' },
  { value: '3', label: '出勤速報' },
  { value: '4', label: '新人速報' },
  { value: '9', label: 'お知らせ' },
]

function todayStr() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '10', '15', '20', '30', '40', '45', '50']

export default function NewsPost({ shopId }: { shopId: string }) {
  const [newsType, setNewsType] = useState('9')
  const [publishNow, setPublishNow] = useState(true)
  const [publishDate, setPublishDate] = useState(todayStr())
  const [publishHour, setPublishHour] = useState('12')
  const [publishMinute, setPublishMinute] = useState('00')
  const [endEnabled, setEndEnabled] = useState(false)
  const [endPublishDate, setEndPublishDate] = useState(todayStr())
  const [endPublishHour, setEndPublishHour] = useState('23')
  const [endPublishMinute, setEndPublishMinute] = useState('00')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [posting, setPosting] = useState(false)

  const canSubmit = shopId && title.trim() && content.trim() && !posting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    if (!confirm('メンズエステランキングにニュースを投稿しますか？\n※1日に投稿できる回数には上限（5回）があります。')) return

    setPosting(true)
    try {
      const fd = new FormData()
      fd.append('shopId', shopId)
      fd.append('newsType', newsType)
      fd.append('title', title.trim())
      fd.append('content', content.trim())
      fd.append('publishNow', String(publishNow))
      if (!publishNow) {
        fd.append('publishDate', publishDate)
        fd.append('publishHour', publishHour)
        fd.append('publishMinute', publishMinute)
      }
      fd.append('endEnabled', String(endEnabled))
      if (endEnabled) {
        fd.append('endPublishDate', endPublishDate)
        fd.append('endPublishHour', endPublishHour)
        fd.append('endPublishMinute', endPublishMinute)
      }
      if (image) fd.append('image', image)

      const res = await fetch('/api/sync/esthe-ranking-news', { method: 'POST', body: fd })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error || 'リクエストに失敗しました')
      }

      alert('バックグラウンドでニュース投稿を開始しました。\n完了状態は「同期履歴」から確認できます。')
      setTitle('')
      setContent('')
      setImage(null)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setPosting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">ニュース投稿（メンズエステランキング）</h2>
          <p className="text-xs text-slate-500 mt-0.5">この画面から投稿すると、メンズエステランキングの店舗管理画面に自動でログインしてニュースを送信します。</p>
        </div>
      </div>

      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
        1日に投稿できる回数は最大5回までです（投稿回数は毎日午前6時にリセットされます）。上限を超えた場合はエラーとなり、同期履歴にその旨が表示されます。
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">ニュース種別</label>
        <select
          value={newsType}
          onChange={(e) => setNewsType(e.target.value)}
          className="w-full sm:w-64 border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
        >
          {NEWS_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-xs font-bold text-slate-700 mb-2">公開開始時刻</p>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input type="radio" checked={publishNow} onChange={() => setPublishNow(true)} />
            すぐに公開
          </label>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input type="radio" checked={!publishNow} onChange={() => setPublishNow(false)} />
            開始時刻を指定
          </label>
          {!publishNow && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <input
                type="date"
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
                className="border border-slate-200 rounded-lg bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <select value={publishHour} onChange={(e) => setPublishHour(e.target.value)} className="border border-slate-200 rounded-lg bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50">
                {HOURS.map((h) => <option key={h} value={h}>{h}時</option>)}
              </select>
              <select value={publishMinute} onChange={(e) => setPublishMinute(e.target.value)} className="border border-slate-200 rounded-lg bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50">
                {MINUTES.map((m) => <option key={m} value={m}>{m}分</option>)}
              </select>
              <p className="text-[10px] text-slate-400 w-full">※ポータル側の仕様上、選択できるのは現在から約24時間先までです。範囲外の場合は最も近い時刻に自動調整されます。</p>
            </div>
          )}
        </div>

        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-xs font-bold text-slate-700 mb-2">公開終了時刻</p>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input type="checkbox" checked={endEnabled} onChange={(e) => setEndEnabled(e.target.checked)} />
            終了時刻を設定する
          </label>
          {endEnabled && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <input
                type="date"
                value={endPublishDate}
                onChange={(e) => setEndPublishDate(e.target.value)}
                className="border border-slate-200 rounded-lg bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <select value={endPublishHour} onChange={(e) => setEndPublishHour(e.target.value)} className="border border-slate-200 rounded-lg bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50">
                {HOURS.map((h) => <option key={h} value={h}>{h}時</option>)}
              </select>
              <select value={endPublishMinute} onChange={(e) => setEndPublishMinute(e.target.value)} className="border border-slate-200 rounded-lg bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50">
                {MINUTES.map((m) => <option key={m} value={m}>{m}分</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">題名</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例）本日18時から新人セラピスト出勤！"
          className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">本文</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="ニュースの本文を入力してください"
          className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>

      <NewsImagePicker image={image} onChange={setImage} />

      <div className="pt-2 border-t border-slate-100">
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full sm:w-auto px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors disabled:opacity-50 text-sm"
        >
          {posting ? '投稿中...' : 'ニュースを投稿する'}
        </button>
      </div>
    </form>
  )
}
