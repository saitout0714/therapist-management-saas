'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'

type ShopRank = { id: string; name: string }

type ScrapedTherapist = {
  name: string
  age: number | null
  height: number | null
  bust: number | null
  bust_cup: string | null
  waist: number | null
  hip: number | null
  comment: string | null
  profile_url?: string | null
  rank?: string | null       // HPから抽出したランク表記
  rank_id?: string | null    // 店舗ランクとマッチングした結果
}

function matchRank(extracted: string | null | undefined, ranks: ShopRank[]): string | null {
  if (!extracted || ranks.length === 0) return null
  const q = extracted.toLowerCase().trim()
  // 完全一致
  const exact = ranks.find(r => r.name.toLowerCase() === q)
  if (exact) return exact.id
  // 部分一致（どちらかが相手を含む）
  const partial = ranks.find(r => {
    const rn = r.name.toLowerCase()
    return rn.includes(q) || q.includes(rn)
  })
  return partial?.id ?? null
}

export default function ImportTherapistsPage() {
  const router = useRouter()
  const { selectedShop } = useShop()
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [therapists, setTherapists] = useState<ScrapedTherapist[]>([])
  const [shopRanks, setShopRanks] = useState<ShopRank[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [enhancing, setEnhancing] = useState(false)
  const [enhanceProgress, setEnhanceProgress] = useState({ done: 0, total: 0 })
  const cancelEnhance = useRef(false)

  const handleScrape = async () => {
    if (!url.trim()) return
    setScraping(true)
    setScrapeError(null)
    setTherapists([])
    setSelected(new Set())
    setDuplicateCount(0)
    cancelEnhance.current = true

    try {
      const res = await fetch('/api/scrape-therapists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'エラーが発生しました')
      const list = (json.therapists as ScrapedTherapist[]) || []

      // 既存セラピスト・ランク情報を並列取得
      let existingNames = new Set<string>()
      let ranks: ShopRank[] = []
      if (selectedShop) {
        const [existingRes, ranksRes] = await Promise.all([
          supabase.from('therapists').select('name').eq('shop_id', selectedShop.id),
          supabase.from('therapist_ranks').select('id, name').eq('shop_id', selectedShop.id).order('display_order'),
        ])
        if (existingRes.data) {
          existingNames = new Set(existingRes.data.map((t: { name: string }) => t.name.trim().toLowerCase()))
        }
        ranks = (ranksRes.data || []) as ShopRank[]
        setShopRanks(ranks)
      }

      const filtered = list
        .filter(t => !existingNames.has(t.name.trim().toLowerCase()))
        .map(t => ({
          ...t,
          rank_id: matchRank(t.rank, ranks),
        }))

      setDuplicateCount(list.length - filtered.length)
      setTherapists(filtered)
      setSelected(new Set(filtered.map((_, i) => i)))

      // プロフィールURLがある全員を個人ページで補完
      const toEnhance = filtered.filter(t => t.profile_url)
      if (toEnhance.length > 0) {
        setScraping(false)
        enhanceInBackground(filtered, toEnhance, ranks)
      }
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : 'エラーが発生しました')
    } finally {
      setScraping(false)
    }
  }

  const enhanceInBackground = async (
    allTherapists: ScrapedTherapist[],
    toEnhance: ScrapedTherapist[],
    ranks: ShopRank[]
  ) => {
    void allTherapists
    cancelEnhance.current = false
    setEnhancing(true)
    setEnhanceProgress({ done: 0, total: toEnhance.length })

    for (let i = 0; i < toEnhance.length; i++) {
      if (cancelEnhance.current) break

      const t = toEnhance[i]
      try {
        const res = await fetch('/api/scrape-therapist-detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: t.profile_url, name: t.name }),
        })
        if (res.ok) {
          const detail = await res.json()
          const newRankId = matchRank(detail.rank, ranks)
          setTherapists(prev => prev.map(p =>
            p.name === t.name
              ? {
                  ...p,
                  age: detail.age ?? p.age,
                  height: detail.height ?? p.height,
                  bust: detail.bust ?? p.bust,
                  bust_cup: detail.bust_cup ?? p.bust_cup,
                  waist: detail.waist ?? p.waist,
                  hip: detail.hip ?? p.hip,
                  rank: detail.rank ?? p.rank,
                  rank_id: newRankId ?? p.rank_id,
                }
              : p
          ))
        }
      } catch {
        // 個別失敗は無視して続行
      }

      setEnhanceProgress({ done: i + 1, total: toEnhance.length })
      if (i < toEnhance.length - 1 && !cancelEnhance.current) {
        await new Promise(r => setTimeout(r, 4000))
      }
    }

    setEnhancing(false)
  }

  const toggleAll = () => {
    if (selected.size === therapists.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(therapists.map((_, i) => i)))
    }
  }

  const toggle = (i: number) => {
    const next = new Set(selected)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    setSelected(next)
  }

  const handleSave = async () => {
    if (!selectedShop) { setSaveError('店舗を選択してください'); return }
    if (selected.size === 0) return
    setSaving(true)
    setSaveError(null)

    const { data: maxOrderData } = await supabase
      .from('therapists').select('order').eq('shop_id', selectedShop.id)
      .order('order', { ascending: false }).limit(1)
    let nextOrder = maxOrderData && maxOrderData.length > 0 && maxOrderData[0].order !== null
      ? maxOrderData[0].order + 1 : 0

    const rows = [...selected].sort((a, b) => a - b).map((i) => {
      const t = therapists[i]
      const row: Record<string, unknown> = { name: t.name, shop_id: selectedShop.id, order: nextOrder++ }
      if (t.age != null) row.age = t.age
      if (t.height != null) row.height = t.height
      if (t.bust != null) row.bust = t.bust
      if (t.bust_cup != null) row.bust_cup = t.bust_cup
      if (t.waist != null) row.waist = t.waist
      if (t.hip != null) row.hip = t.hip
      if (t.comment != null) row.comment = t.comment
      if (t.rank_id) row.rank_id = t.rank_id
      return row
    })

    const { error } = await supabase.from('therapists').insert(rows)
    setSaving(false)
    if (error) { setSaveError('登録に失敗しました: ' + error.message); return }
    router.push('/therapists')
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/therapists"
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm border border-slate-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">HPから一括インポート</h1>
            <p className="text-sm text-slate-500 mt-1">セラピスト一覧ページURLを入力すると全員を自動で読み取ります。プロフィール・ランクも個人ページから取得します。</p>
          </div>
        </div>

        {/* URL入力 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">セラピスト一覧ページのURL</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
              placeholder="https://example.com/cast"
              className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none bg-slate-50"
            />
            <button
              type="button"
              onClick={handleScrape}
              disabled={scraping || !url.trim()}
              className="px-5 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap flex items-center gap-2"
            >
              {scraping ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  読み取り中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  読み取る
                </>
              )}
            </button>
          </div>
          {scrapeError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm">{scrapeError}</div>
          )}
          {duplicateCount > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-sm">
              すでに登録済みのセラピストが {duplicateCount}人 含まれていたため、除外しました。
            </div>
          )}
        </div>

        {/* 補完中バナー */}
        {enhancing && (
          <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center gap-3 text-sm text-indigo-700">
            <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>
              個人ページからプロフィール・ランクを取得中... ({enhanceProgress.done}/{enhanceProgress.total}人完了)
            </span>
          </div>
        )}

        {/* 結果一覧 */}
        {therapists.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                  style={{
                    borderColor: selected.size === therapists.length ? '#4f46e5' : '#cbd5e1',
                    backgroundColor: selected.size === therapists.length ? '#4f46e5' : 'white',
                  }}
                >
                  {selected.size === therapists.length && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <span className="text-sm font-semibold text-slate-700">
                  {therapists.length}人を検出 — {selected.size}人を選択中
                </span>
              </div>
            </div>

            <ul className="divide-y divide-slate-100">
              {therapists.map((t, i) => (
                <li
                  key={i}
                  onClick={() => toggle(i)}
                  className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors ${selected.has(i) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                >
                  <div
                    className="w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors"
                    style={{
                      borderColor: selected.has(i) ? '#4f46e5' : '#cbd5e1',
                      backgroundColor: selected.has(i) ? '#4f46e5' : 'white',
                    }}
                  >
                    {selected.has(i) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg flex-shrink-0">
                    {t.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-800">{t.name}</p>
                      {/* ランク表示 */}
                      {t.rank_id ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                          {shopRanks.find(r => r.id === t.rank_id)?.name}
                        </span>
                      ) : t.rank && enhancing ? (
                        <span className="text-xs text-amber-500">「{t.rank}」照合中...</span>
                      ) : t.rank ? (
                        <span className="text-xs text-slate-400">「{t.rank}」→ 未一致</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {[
                        t.age != null && `${t.age}歳`,
                        t.height != null && `${t.height}cm`,
                        (t.bust != null || t.waist != null || t.hip != null)
                          ? `B${t.bust ?? '-'}${t.bust_cup ?? ''} W${t.waist ?? '-'} H${t.hip ?? '-'}`
                          : (enhancing && t.profile_url ? '取得中...' : null),
                      ].filter(Boolean).join(' · ') || '詳細情報なし'}
                    </p>
                    {t.comment && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.comment}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="p-5 border-t border-slate-100 flex items-center justify-between">
              {saveError && <p className="text-sm text-rose-600">{saveError}</p>}
              <div className="ml-auto flex flex-col items-end gap-1">
                {enhancing && (
                  <p className="text-xs text-amber-600">ランク・プロフィール取得完了後に登録できます</p>
                )}
                <div className="flex gap-3">
                  <Link
                    href="/therapists"
                    className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    キャンセル
                  </Link>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || selected.size === 0 || enhancing}
                    className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        登録中...
                      </>
                    ) : `${selected.size}人を登録する`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
