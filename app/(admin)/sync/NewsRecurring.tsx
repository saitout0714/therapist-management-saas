'use client'

import { useEffect, useState } from 'react'
import NewsImagePicker from './NewsImagePicker'

const NEWS_TYPES: { value: string; label: string }[] = [
  { value: '1', label: '割引情報' },
  { value: '2', label: 'イベント' },
  { value: '3', label: '出勤速報' },
  { value: '4', label: '新人速報' },
  { value: '9', label: 'お知らせ' },
]
const NEWS_TYPE_LABEL: Record<string, string> = Object.fromEntries(NEWS_TYPES.map((t) => [t.value, t.label]))

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

interface RecurringRule {
  id: string
  news_type: string
  title: string
  content: string
  image_url: string | null
  days_of_week: number[]
  time_of_day: string
  start_date: string
  end_date: string | null
  status: 'active' | 'paused'
}

function todayStr() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
}

export default function NewsRecurring({ shopId }: { shopId: string }) {
  const [newsType, setNewsType] = useState('9')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5, 6, 0])
  const [timeOfDay, setTimeOfDay] = useState('12:00')
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRules = async () => {
    if (!shopId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/news-recurring?shopId=${shopId}`)
      const data = await res.json()
      setRules(data.rules || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRules()
  }, [shopId])

  const toggleDow = (d: number) => {
    setDaysOfWeek((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()))
  }

  const canSubmit = shopId && title.trim() && content.trim() && daysOfWeek.length > 0 && timeOfDay && startDate && !saving

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
      fd.append('daysOfWeek', daysOfWeek.join(','))
      fd.append('timeOfDay', timeOfDay)
      fd.append('startDate', startDate)
      if (endDate) fd.append('endDate', endDate)
      if (image) fd.append('image', image)

      const res = await fetch('/api/news-recurring', { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || '定期投稿ルールの登録に失敗しました')

      setTitle('')
      setContent('')
      setImage(null)
      setEndDate('')
      await fetchRules()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (rule: RecurringRule) => {
    const nextStatus = rule.status === 'active' ? 'paused' : 'active'
    try {
      const res = await fetch(`/api/news-recurring/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) throw new Error('更新に失敗しました')
      await fetchRules()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleDelete = async (rule: RecurringRule) => {
    if (!confirm(`「${rule.title}」の定期投稿ルールを削除しますか？\n※これまでに投稿済みの記事は削除されません。`)) return
    try {
      const res = await fetch(`/api/news-recurring/${rule.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      await fetchRules()
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">毎日（または曜日指定で）同じ内容を繰り返し投稿</h2>
            <p className="text-xs text-slate-500 mt-0.5">選んだ曜日・時刻になると、自動的に同じ内容の記事が予約投稿として登録され、その時刻に投稿されます。</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">曜日</label>
          <div className="flex gap-1.5 flex-wrap">
            {DOW_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleDow(i)}
                className={`w-10 h-10 rounded-full text-sm font-bold border transition-colors ${
                  daysOfWeek.includes(i) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">ニュース種別</label>
            <select value={newsType} onChange={(e) => setNewsType(e.target.value)} className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50">
              {NEWS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">投稿する時刻</label>
            <input type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">開始日</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">終了日（任意）</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">題名</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例）本日も18時オープン！" className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">本文</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="毎回同じ内容で投稿されます" className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" />
        </div>

        <NewsImagePicker image={image} onChange={setImage} />

        <div className="pt-2 border-t border-slate-100">
          <button type="submit" disabled={!canSubmit} className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 text-sm">
            {saving ? '登録中...' : 'このルールを登録する'}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-800">定期投稿ルール一覧</h2>
          <button onClick={fetchRules} disabled={loading} className="text-sm text-indigo-600 hover:text-indigo-800 font-bold disabled:opacity-50">更新</button>
        </div>

        {loading && rules.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">読み込み中...</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">定期投稿ルールはありません</p>
        ) : (
          <div className="space-y-3">
            {rules.map((r) => (
              <div key={r.id} className="p-3.5 border border-slate-100 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${r.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {r.status === 'active' ? '有効' : '一時停止中'}
                    </span>
                    <span className="text-xs text-slate-500">{NEWS_TYPE_LABEL[r.news_type] || r.news_type}</span>
                    <span className="font-bold text-sm text-slate-800 truncate">{r.title}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {r.days_of_week.slice().sort().map((d) => DOW_LABELS[d]).join('・')}曜日の{r.time_of_day} に投稿 / {r.start_date}〜{r.end_date || '無期限'}
                  </p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <button onClick={() => handleToggleStatus(r)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                    {r.status === 'active' ? '一時停止' : '再開する'}
                  </button>
                  <button onClick={() => handleDelete(r)} className="text-xs font-bold text-rose-600 hover:text-rose-800">
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
