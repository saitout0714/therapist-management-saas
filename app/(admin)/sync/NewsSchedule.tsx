'use client'

import { useEffect, useRef, useState } from 'react'
import NewsImagePicker from './NewsImagePicker'

const NEWS_TYPES: { value: string; label: string }[] = [
  { value: '1', label: '割引情報' },
  { value: '2', label: 'イベント' },
  { value: '3', label: '出勤速報' },
  { value: '4', label: '新人速報' },
  { value: '9', label: 'お知らせ' },
]

const NEWS_TYPE_LABEL: Record<string, string> = Object.fromEntries(NEWS_TYPES.map((t) => [t.value, t.label]))

interface NewsDraft {
  id: string
  news_type: string
  title: string
  content: string
  image_url: string | null
  scheduled_at: string
  status: 'pending' | 'posted' | 'failed' | 'cancelled'
  error_message: string | null
  posted_at: string | null
}

function addOneDay(iso: string) {
  const d = new Date(iso)
  d.setDate(d.getDate() + 1)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

async function urlToFile(url: string): Promise<File | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const ext = url.match(/\.(jpg|jpeg|png)(\?|$)/i)?.[1]?.toLowerCase() || 'jpg'
    return new File([blob], `image.${ext}`, { type: blob.type || 'image/jpeg' })
  } catch (e) {
    console.error('Failed to load image for duplication:', e)
    return null
  }
}

function defaultScheduledAt() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset() + 60) // 1時間後をデフォルトに
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

export default function NewsSchedule({ shopId }: { shopId: string }) {
  const [newsType, setNewsType] = useState('9')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [scheduledAt, setScheduledAt] = useState(defaultScheduledAt())
  const [saving, setSaving] = useState(false)
  const [drafts, setDrafts] = useState<NewsDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const fetchDrafts = async () => {
    if (!shopId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/news-drafts?shopId=${shopId}`)
      const data = await res.json()
      setDrafts(data.drafts || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDrafts()
  }, [shopId])

  const canSubmit = shopId && title.trim() && content.trim() && scheduledAt && !saving

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('shopId', shopId)
      fd.append('newsType', newsType)
      fd.append('title', title.trim())
      fd.append('content', content.trim())
      fd.append('scheduledAt', new Date(scheduledAt).toISOString())
      if (image) fd.append('image', image)

      const res = await fetch('/api/news-drafts', { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || '予約投稿の登録に失敗しました')

      if (data?.warning) alert(data.warning)

      setTitle('')
      setContent('')
      setImage(null)
      setScheduledAt(defaultScheduledAt())
      await fetchDrafts()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('この予約投稿を取り消しますか？')) return
    try {
      const res = await fetch(`/api/news-drafts/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || '取り消しに失敗しました')
      await fetchDrafts()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleDuplicate = async (draft: NewsDraft) => {
    setDuplicatingId(draft.id)
    try {
      setNewsType(draft.news_type)
      setTitle(draft.title)
      setContent(draft.content)
      setScheduledAt(addOneDay(draft.scheduled_at))

      if (draft.image_url) {
        const file = await urlToFile(draft.image_url)
        setImage(file)
        if (!file) alert('画像の複製に失敗しました。お手数ですが画像は再度選択してください。')
      } else {
        setImage(null)
      }

      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } finally {
      setDuplicatingId(null)
    }
  }

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr)
    return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', weekday: 'short' })
  }

  const statusBadge = (status: NewsDraft['status']) => {
    const map: Record<NewsDraft['status'], string> = {
      pending: 'bg-blue-100 text-blue-700',
      posted: 'bg-emerald-100 text-emerald-700',
      failed: 'bg-rose-100 text-rose-700',
      cancelled: 'bg-slate-100 text-slate-500',
    }
    const label: Record<NewsDraft['status'], string> = {
      pending: '予約中',
      posted: '投稿済み',
      failed: '失敗',
      cancelled: '取消済み',
    }
    return <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${map[status]}`}>{label[status]}</span>
  }

  const pendingCount = drafts.filter((d) => d.status === 'pending').length

  return (
    <div className="space-y-6">
      <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">ニュースの予約投稿</h2>
            <p className="text-xs text-slate-500 mt-0.5">記事をあらかじめ登録しておくと、指定した日時に自動でメンズエステランキングへ投稿します（5分おきにチェックされます）。</p>
          </div>
        </div>

        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
          1日に投稿できるのは最大5回までです（メンズエステランキング側の仕様）。同じ日に6件目以降を予約すると、その分は投稿時にエラーになります。
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">ニュース種別</label>
            <select
              value={newsType}
              onChange={(e) => setNewsType(e.target.value)}
              className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              {NEWS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">投稿する日時</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
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
            rows={5}
            placeholder="ニュースの本文を入力してください"
            className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>

        <NewsImagePicker image={image} onChange={setImage} />

        <div className="pt-2 border-t border-slate-100">
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm"
          >
            {saving ? '登録中...' : 'この内容で予約する'}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-800">予約投稿の一覧（予約中 {pendingCount}件）</h2>
          <button onClick={fetchDrafts} disabled={loading} className="text-sm text-indigo-600 hover:text-indigo-800 font-bold disabled:opacity-50">
            更新
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold">投稿予定日時</th>
                <th className="px-4 py-3 font-semibold">種別</th>
                <th className="px-4 py-3 font-semibold">題名</th>
                <th className="px-4 py-3 font-semibold">状態</th>
                <th className="px-4 py-3 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && drafts.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">読み込み中...</td></tr>
              ) : drafts.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">予約投稿はありません</td></tr>
              ) : (
                drafts.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50/50 align-top">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(d.scheduled_at)}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{NEWS_TYPE_LABEL[d.news_type] || d.news_type}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{d.title}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {statusBadge(d.status)}
                      {d.status === 'failed' && d.error_message && (
                        <div className="text-[11px] text-rose-600 mt-1 max-w-xs">{d.error_message.length > 80 ? d.error_message.slice(0, 80) + '…' : d.error_message}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap space-x-3">
                      <button
                        onClick={() => handleDuplicate(d)}
                        disabled={duplicatingId === d.id}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-bold disabled:opacity-50"
                      >
                        {duplicatingId === d.id ? '複製中...' : '複製'}
                      </button>
                      {d.status === 'pending' && (
                        <button onClick={() => handleCancel(d.id)} className="text-xs text-rose-600 hover:text-rose-800 font-bold">
                          取り消す
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
