'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import Image from 'next/image'

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
  rank?: string | null
  rank_id?: string | null
  photo_url?: string | null
}

type ExistingTherapist = {
  id: string
  name: string
  hp_url: string | null
  inputUrl: string
  matched: boolean        // 一覧URLから自動マッチできたか
  status: 'idle' | 'fetching' | 'done' | 'error'
  photo_url: string | null
  errorMsg: string | null
}

type ProfileTherapist = {
  id: string
  name: string
  hp_url: string | null
  age: number | null
  height: number | null
  bust: number | null
  bust_cup: string | null
  waist: number | null
  hip: number | null
  comment: string | null
  editAge: string
  editHeight: string
  editBust: string
  editBustCup: string
  editWaist: string
  editHip: string
  editComment: string
  status: 'idle' | 'fetching' | 'error'
  errorMsg: string | null
}

type Mode = 'import' | 'add-photos' | 'fill-profiles'

function matchRank(extracted: string | null | undefined, ranks: ShopRank[]): string | null {
  if (!extracted || ranks.length === 0) return null
  const q = extracted.toLowerCase().trim()
  const exact = ranks.find(r => r.name.toLowerCase() === q)
  if (exact) return exact.id
  const partial = ranks.find(r => { const rn = r.name.toLowerCase(); return rn.includes(q) || q.includes(rn) })
  return partial?.id ?? null
}

export default function ImportTherapistsPage() {
  const router = useRouter()
  const { selectedShop } = useShop()
  const [mode, setMode] = useState<Mode>('import')

  // --- 新規取り込みモード ---
  const [url, setUrl] = useState('')
  const [shopUrls, setShopUrls] = useState<{ hp_url: string; therapist_list_url: string; schedule_url: string } | null>(null)

  useEffect(() => {
    if (!selectedShop) return
    const fetchShopUrls = async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('hp_url, therapist_list_url, schedule_url')
        .eq('shop_id', selectedShop.id)
        .limit(1)
      if (data?.[0]) {
        const urls = {
          hp_url: data[0].hp_url ?? '',
          therapist_list_url: data[0].therapist_list_url ?? '',
          schedule_url: data[0].schedule_url ?? '',
        }
        setShopUrls(urls)
        if (urls.therapist_list_url) {
          setUrl(urls.therapist_list_url)
          setPhotoModeUrl(urls.therapist_list_url)
        }
      }
    }
    void fetchShopUrls()
  }, [selectedShop])
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

  // --- プロフィール補完モード ---
  const [profileTherapists, setProfileTherapists] = useState<ProfileTherapist[]>([])
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaveMsg, setProfileSaveMsg] = useState<string | null>(null)
  const [profileBulkFetching, setProfileBulkFetching] = useState(false)
  const cancelProfileBulk = useRef(false)
  const [profileBulkProgress, setProfileBulkProgress] = useState({ done: 0, total: 0 })

  // --- 写真補完モード ---
  const [photoModeUrl, setPhotoModeUrl] = useState('')
  const [photoScraping, setPhotoScraping] = useState(false)
  const [photoScrapeError, setPhotoScrapeError] = useState<string | null>(null)
  const [existingTherapists, setExistingTherapists] = useState<ExistingTherapist[]>([])
  const [bulkFetching, setBulkFetching] = useState(false)
  const cancelBulk = useRef(false)
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 })

  // ===== 新規取り込みモード =====

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

      let existingNames = new Set<string>()
      let ranks: ShopRank[] = []
      if (selectedShop) {
        const [existingRes, ranksRes] = await Promise.all([
          supabase.from('therapists').select('name').eq('shop_id', selectedShop.id),
          supabase.from('therapist_ranks').select('id, name').eq('shop_id', selectedShop.id).order('display_order'),
        ])
        if (existingRes.data) existingNames = new Set(existingRes.data.map((t: { name: string }) => t.name.trim().toLowerCase()))
        ranks = (ranksRes.data || []) as ShopRank[]
        setShopRanks(ranks)
      }

      const filtered = list
        .filter(t => !existingNames.has(t.name.trim().toLowerCase()))
        .map(t => ({ ...t, rank_id: matchRank(t.rank, ranks) }))

      setDuplicateCount(list.length - filtered.length)
      setTherapists(filtered)
      setSelected(new Set(filtered.map((_, i) => i)))

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
                  photo_url: detail.photo_url ?? p.photo_url,
                }
              : p
          ))
        }
      } catch { /* 個別失敗は無視 */ }

      setEnhanceProgress({ done: i + 1, total: toEnhance.length })
      if (i < toEnhance.length - 1 && !cancelEnhance.current) {
        await new Promise(r => setTimeout(r, 4000))
      }
    }
    setEnhancing(false)
  }

  const toggleAll = () => {
    if (selected.size === therapists.length) setSelected(new Set())
    else setSelected(new Set(therapists.map((_, i) => i)))
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

    const toSave = [...selected].sort((a, b) => a - b).map(i => therapists[i])
    const rows = toSave.map(t => {
      const row: Record<string, unknown> = { name: t.name, shop_id: selectedShop.id, order: nextOrder++ }
      if (t.age != null) row.age = t.age
      if (t.height != null) row.height = t.height
      if (t.bust != null) row.bust = t.bust
      if (t.bust_cup != null) row.bust_cup = t.bust_cup
      if (t.waist != null) row.waist = t.waist
      if (t.hip != null) row.hip = t.hip
      if (t.comment != null) row.comment = t.comment
      if (t.rank_id) row.rank_id = t.rank_id
      if (t.profile_url) row.hp_url = t.profile_url
      return row
    })

    const { data: inserted, error } = await supabase.from('therapists').insert(rows).select('id, name')
    if (error) { setSaveError('登録に失敗しました: ' + error.message); setSaving(false); return }

    // 写真をアップロード（photo_urlがあるセラピストのみ）
    const photoJobs = (inserted || []).map((th: { id: string; name: string }) => {
      const src = toSave.find(t => t.name === th.name)
      return src?.photo_url ? { therapist_id: th.id, photo_url: src.photo_url } : null
    }).filter(Boolean) as { therapist_id: string; photo_url: string }[]

    if (photoJobs.length > 0) {
      await Promise.allSettled(
        photoJobs.map(job =>
          fetch('/api/save-photo-from-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(job),
          })
        )
      )
    }

    setSaving(false)
    router.push('/therapists')
  }

  // ===== 写真補完モード =====

  // 名前正規化（スペース除去・小文字化）
  const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '').replace(/　/g, '')

  const handlePhotoScrape = async () => {
    if (!selectedShop) { setPhotoScrapeError('店舗を選択してください'); return }
    setPhotoScraping(true)
    setPhotoScrapeError(null)
    setExistingTherapists([])

    // 写真なしの既存セラピストを取得
    const { data: allTherapists } = await supabase
      .from('therapists')
      .select('id, name, hp_url')
      .eq('shop_id', selectedShop.id)
      .eq('is_active', true)
      .order('order', { ascending: true, nullsFirst: false })

    if (!allTherapists || allTherapists.length === 0) {
      setPhotoScrapeError('セラピストが登録されていません')
      setPhotoScraping(false)
      return
    }

    const { data: withPhotosData } = await supabase
      .from('therapist_photos')
      .select('therapist_id')
      .in('therapist_id', allTherapists.map((t: { id: string }) => t.id))

    const withPhotoIds = new Set((withPhotosData || []).map((p: { therapist_id: string }) => p.therapist_id))
    const withoutPhotos = (allTherapists as { id: string; name: string; hp_url: string | null }[])
      .filter(t => !withPhotoIds.has(t.id))

    if (withoutPhotos.length === 0) {
      setPhotoScrapeError('写真なしのセラピストはいません')
      setPhotoScraping(false)
      return
    }

    // 一覧ページをスクレイプ
    let scraped: Array<{ name: string; profile_url?: string | null }> = []
    if (photoModeUrl.trim()) {
      try {
        const res = await fetch('/api/scrape-therapists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: photoModeUrl }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'エラーが発生しました')
        // AIがブロックされた場合はURLマッチングをスキップして続行
        scraped = json.blocked ? [] : (json.therapists || [])
        if (json.blocked) {
          setPhotoScrapeError('AIによるURL自動マッチングができませんでした。各セラピストのURLを手動で入力してください。')
        }
      } catch (e) {
        setPhotoScrapeError(e instanceof Error ? e.message : 'スクレイピングに失敗しました')
        setPhotoScraping(false)
        return
      }
    }

    // 名前マッチング
    const result: ExistingTherapist[] = withoutPhotos.map(existing => {
      const en = normalizeName(existing.name)
      const match = scraped.find(s => {
        const sn = normalizeName(s.name)
        return sn === en || sn.includes(en) || en.includes(sn)
      })
      return {
        id: existing.id,
        name: existing.name,
        hp_url: existing.hp_url,
        inputUrl: match?.profile_url || existing.hp_url || '',
        matched: !!match?.profile_url,
        status: 'idle' as const,
        photo_url: null,
        errorMsg: null,
      }
    })

    setExistingTherapists(result)

    // 新たにURLが判明したセラピストのhp_urlをDBに一括保存（matched に限らず）
    const toUpdate = result.filter(t => t.inputUrl && t.inputUrl !== t.hp_url)
    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map(t => supabase.from('therapists').update({ hp_url: t.inputUrl }).eq('id', t.id))
      )
    }

    setPhotoScraping(false)
  }

  const fetchPhotoForTherapist = async (therapistId: string, profileUrl: string): Promise<void> => {
    setExistingTherapists(prev => prev.map(t => t.id === therapistId ? { ...t, status: 'fetching', errorMsg: null } : t))

    // URLが既存と異なる場合は取得成功・失敗に関わらず先に保存
    const current = existingTherapists.find(t => t.id === therapistId)
    if (profileUrl && profileUrl !== current?.hp_url) {
      await supabase.from('therapists').update({ hp_url: profileUrl }).eq('id', therapistId)
      setExistingTherapists(prev => prev.map(t => t.id === therapistId ? { ...t, hp_url: profileUrl } : t))
    }

    try {
      // 1. プロフィールページから写真URLを抽出
      const detailRes = await fetch('/api/scrape-therapist-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: profileUrl }),
      })
      const detail = await detailRes.json()

      if (!detail.photo_url) {
        setExistingTherapists(prev => prev.map(t =>
          t.id === therapistId ? { ...t, status: 'error', errorMsg: '写真が見つかりませんでした' } : t
        ))
        return
      }

      // 2. 写真をダウンロードしてStorageに保存
      const saveRes = await fetch('/api/save-photo-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_url: detail.photo_url, therapist_id: therapistId }),
      })
      const saveData = await saveRes.json()

      if (!saveRes.ok) {
        setExistingTherapists(prev => prev.map(t =>
          t.id === therapistId ? { ...t, status: 'error', errorMsg: saveData.error || '保存に失敗しました' } : t
        ))
        return
      }

      setExistingTherapists(prev => prev.map(t =>
        t.id === therapistId ? { ...t, status: 'done', photo_url: saveData.photo?.photo_url || detail.photo_url } : t
      ))
    } catch (e) {
      const msg = e instanceof Error ? e.message : '不明なエラー'
      setExistingTherapists(prev => prev.map(t =>
        t.id === therapistId ? { ...t, status: 'error', errorMsg: msg } : t
      ))
    }
  }

  const handleBulkFetch = async () => {
    const targets = existingTherapists.filter(t => t.inputUrl.trim() && t.status !== 'done')
    if (targets.length === 0) return
    cancelBulk.current = false
    setBulkFetching(true)
    setBulkProgress({ done: 0, total: targets.length })

    for (let i = 0; i < targets.length; i++) {
      if (cancelBulk.current) break
      await fetchPhotoForTherapist(targets[i].id, targets[i].inputUrl.trim())
      setBulkProgress({ done: i + 1, total: targets.length })
      if (i < targets.length - 1 && !cancelBulk.current) {
        await new Promise(r => setTimeout(r, 3000))
      }
    }
    setBulkFetching(false)
  }

  // ===== プロフィール補完モード =====

  const loadProfileTherapists = async () => {
    if (!selectedShop) { setProfileError('店舗を選択してください'); return }
    setProfileLoading(true)
    setProfileError(null)
    setProfileSaveMsg(null)
    setProfileTherapists([])

    const { data, error } = await supabase
      .from('therapists')
      .select('id, name, hp_url, age, height, bust, bust_cup, waist, hip, comment')
      .eq('shop_id', selectedShop.id)
      .eq('is_active', true)
      .order('order', { ascending: true, nullsFirst: false })

    if (error) { setProfileError(error.message); setProfileLoading(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const incomplete = (data || []).filter((t: any) =>
      t.age == null || t.height == null || t.bust == null || t.waist == null || t.hip == null || !t.comment
    )

    if (incomplete.length === 0) {
      setProfileError('未入力項目のあるセラピストはいません')
      setProfileLoading(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setProfileTherapists((incomplete as any[]).map(t => ({
      id: t.id,
      name: t.name,
      hp_url: t.hp_url,
      age: t.age,
      height: t.height,
      bust: t.bust,
      bust_cup: t.bust_cup,
      waist: t.waist,
      hip: t.hip,
      comment: t.comment,
      editAge: t.age?.toString() ?? '',
      editHeight: t.height?.toString() ?? '',
      editBust: t.bust?.toString() ?? '',
      editBustCup: t.bust_cup ?? '',
      editWaist: t.waist?.toString() ?? '',
      editHip: t.hip?.toString() ?? '',
      editComment: t.comment ?? '',
      status: 'idle' as const,
      errorMsg: null,
    })))

    setProfileLoading(false)
  }

  const fetchProfileData = async (therapistId: string): Promise<void> => {
    const therapist = profileTherapists.find(t => t.id === therapistId)
    if (!therapist?.hp_url) return

    setProfileTherapists(prev => prev.map(t => t.id === therapistId ? { ...t, status: 'fetching', errorMsg: null } : t))

    try {
      const res = await fetch('/api/scrape-therapist-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: therapist.hp_url, name: therapist.name }),
      })
      const detail = await res.json()
      if (!res.ok) throw new Error(detail.error || 'エラーが発生しました')

      setProfileTherapists(prev => prev.map(t => {
        if (t.id !== therapistId) return t
        return {
          ...t,
          editAge: !t.editAge && detail.age != null ? String(detail.age) : t.editAge,
          editHeight: !t.editHeight && detail.height != null ? String(detail.height) : t.editHeight,
          editBust: !t.editBust && detail.bust != null ? String(detail.bust) : t.editBust,
          editBustCup: !t.editBustCup && detail.bust_cup ? detail.bust_cup : t.editBustCup,
          editWaist: !t.editWaist && detail.waist != null ? String(detail.waist) : t.editWaist,
          editHip: !t.editHip && detail.hip != null ? String(detail.hip) : t.editHip,
          editComment: !t.editComment && detail.comment ? detail.comment : t.editComment,
          status: 'idle' as const,
        }
      }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : '不明なエラー'
      setProfileTherapists(prev => prev.map(t => t.id === therapistId ? { ...t, status: 'error', errorMsg: msg } : t))
    }
  }

  const handleBulkProfileFetch = async () => {
    const targets = profileTherapists.filter(t => t.hp_url && t.status !== 'fetching')
    if (targets.length === 0) return
    cancelProfileBulk.current = false
    setProfileBulkFetching(true)
    setProfileBulkProgress({ done: 0, total: targets.length })

    for (let i = 0; i < targets.length; i++) {
      if (cancelProfileBulk.current) break
      await fetchProfileData(targets[i].id)
      setProfileBulkProgress({ done: i + 1, total: targets.length })
      if (i < targets.length - 1 && !cancelProfileBulk.current) {
        await new Promise(r => setTimeout(r, 4000))
      }
    }
    setProfileBulkFetching(false)
  }

  const parseNum = (s: string): number | null => { const n = parseInt(s); return isNaN(n) ? null : n }

  const handleSaveProfiles = async () => {
    if (!selectedShop) return
    const changed = profileTherapists.filter(t => {
      return t.editAge !== (t.age?.toString() ?? '') ||
        t.editHeight !== (t.height?.toString() ?? '') ||
        t.editBust !== (t.bust?.toString() ?? '') ||
        t.editBustCup !== (t.bust_cup ?? '') ||
        t.editWaist !== (t.waist?.toString() ?? '') ||
        t.editHip !== (t.hip?.toString() ?? '') ||
        t.editComment !== (t.comment ?? '')
    })
    if (changed.length === 0) { setProfileSaveMsg('変更がありません'); return }

    setProfileSaving(true)
    setProfileSaveMsg(null)

    await Promise.all(changed.map(t => {
      const update: Record<string, unknown> = {}
      const newAge = parseNum(t.editAge)
      const newHeight = parseNum(t.editHeight)
      const newBust = parseNum(t.editBust)
      const newWaist = parseNum(t.editWaist)
      const newHip = parseNum(t.editHip)
      if (newAge !== t.age) update.age = newAge
      if (newHeight !== t.height) update.height = newHeight
      if (newBust !== t.bust) update.bust = newBust
      if (t.editBustCup !== (t.bust_cup ?? '')) update.bust_cup = t.editBustCup || null
      if (newWaist !== t.waist) update.waist = newWaist
      if (newHip !== t.hip) update.hip = newHip
      if (t.editComment !== (t.comment ?? '')) update.comment = t.editComment || null
      if (Object.keys(update).length === 0) return Promise.resolve()
      return supabase.from('therapists').update(update).eq('id', t.id)
    }))

    setProfileSaving(false)
    setProfileSaveMsg(`${changed.length}人のプロフィールを更新しました`)
    await loadProfileTherapists()
  }

  const updateProfileField = (id: string, field: keyof ProfileTherapist, value: string) => {
    setProfileTherapists(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  const photoCount = therapists.filter(t => t.photo_url).length

  return (
    <div className="bg-gray-100 p-4 md:p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-4">
          <Link
            href="/therapists"
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm border border-slate-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">HPから取り込み</h1>
            <p className="text-sm text-slate-500 mt-1">セラピスト情報と写真をHPから自動で読み取ります。</p>
          </div>
        </div>

        {/* モード切替 */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setMode('import')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${mode === 'import' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            新規取り込み
          </button>
          <button
            onClick={() => setMode('add-photos')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${mode === 'add-photos' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            写真を追加（既存）
          </button>
          <button
            onClick={() => { setMode('fill-profiles'); if (profileTherapists.length === 0) loadProfileTherapists() }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${mode === 'fill-profiles' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            プロフィール補完
          </button>
        </div>

        {/* ===== 新規取り込みモード ===== */}
        {mode === 'import' && (
          <>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6 space-y-4">
              <label className="block text-sm font-semibold text-slate-700">セラピスト一覧ページのURL</label>
              {shopUrls && (shopUrls.hp_url || shopUrls.therapist_list_url || shopUrls.schedule_url) && (
                <div className="flex flex-wrap gap-2">
                  {shopUrls.hp_url && (
                    <button
                      type="button"
                      onClick={() => setUrl(shopUrls.hp_url)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${url === shopUrls.hp_url ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-400'}`}
                    >
                      HP
                    </button>
                  )}
                  {shopUrls.therapist_list_url && (
                    <button
                      type="button"
                      onClick={() => setUrl(shopUrls.therapist_list_url)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${url === shopUrls.therapist_list_url ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-400'}`}
                    >
                      セラピスト一覧
                    </button>
                  )}
                  {shopUrls.schedule_url && (
                    <button
                      type="button"
                      onClick={() => setUrl(shopUrls.schedule_url)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${url === shopUrls.schedule_url ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-400'}`}
                    >
                      スケジュール
                    </button>
                  )}
                </div>
              )}
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
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>読み取り中...</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>読み取る</>
                  )}
                </button>
              </div>
              {scrapeError && <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm">{scrapeError}</div>}
              {duplicateCount > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-sm">
                  すでに登録済みのセラピストが {duplicateCount}人 含まれていたため、除外しました。
                </div>
              )}
            </div>

            {enhancing && (
              <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center gap-3 text-sm text-indigo-700">
                <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                <span>個人ページからプロフィール・写真を取得中... ({enhanceProgress.done}/{enhanceProgress.total}人完了)</span>
              </div>
            )}

            {therapists.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                      style={{ borderColor: selected.size === therapists.length ? '#4f46e5' : '#cbd5e1', backgroundColor: selected.size === therapists.length ? '#4f46e5' : 'white' }}
                    >
                      {selected.size === therapists.length && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      )}
                    </button>
                    <span className="text-sm font-semibold text-slate-700">
                      {therapists.length}人を検出 — {selected.size}人を選択中
                      {photoCount > 0 && <span className="ml-2 text-indigo-600 font-normal">（写真あり: {photoCount}人）</span>}
                    </span>
                  </div>
                </div>

                <ul className="divide-y divide-slate-100">
                  {therapists.map((t, i) => (
                    <li
                      key={i}
                      onClick={() => toggle(i)}
                      className={`flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors ${selected.has(i) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                    >
                      <div
                        className="w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors"
                        style={{ borderColor: selected.has(i) ? '#4f46e5' : '#cbd5e1', backgroundColor: selected.has(i) ? '#4f46e5' : 'white' }}
                      >
                        {selected.has(i) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      {/* サムネイル */}
                      <div className="w-12 h-16 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 relative">
                        {t.photo_url ? (
                          <Image src={t.photo_url} alt={t.name} fill className="object-cover" unoptimized />
                        ) : enhancing && t.profile_url ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-slate-300 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-800">{t.name}</p>
                          {t.rank_id ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                              {shopRanks.find(r => r.id === t.rank_id)?.name}
                            </span>
                          ) : t.rank && enhancing ? (
                            <span className="text-xs text-amber-500">「{t.rank}」照合中...</span>
                          ) : t.rank ? (
                            <span className="text-xs text-slate-400">「{t.rank}」→ 未一致</span>
                          ) : null}
                          {t.photo_url && (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">写真あり</span>
                          )}
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
                        {t.comment && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{t.comment}</p>}
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="p-5 border-t border-slate-100 flex items-center justify-between">
                  {saveError && <p className="text-sm text-rose-600">{saveError}</p>}
                  <div className="ml-auto flex flex-col items-end gap-1">
                    {enhancing && <p className="text-xs text-amber-600">取得完了後に登録できます</p>}
                    <div className="flex gap-3">
                      <Link href="/therapists" className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
                        キャンセル
                      </Link>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || selected.size === 0 || enhancing}
                        className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {saving ? (
                          <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>登録中...</>
                        ) : `${selected.size}人を登録する`}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== プロフィール補完モード ===== */}
        {mode === 'fill-profiles' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">未入力項目があるセラピストを一覧表示します</p>
                <p className="text-xs text-slate-400 mt-0.5">HPのURLが登録されている場合、自動でプロフィール情報を取得できます。</p>
              </div>
              <div className="flex items-center gap-2">
                {profileTherapists.length > 0 && (
                  profileBulkFetching ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-indigo-600">
                        <svg className="inline w-4 h-4 animate-spin mr-1" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        {profileBulkProgress.done}/{profileBulkProgress.total}人完了
                      </span>
                      <button
                        onClick={() => { cancelProfileBulk.current = true; setProfileBulkFetching(false) }}
                        className="px-3 py-1.5 bg-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-300"
                      >停止</button>
                    </div>
                  ) : (
                    <button
                      onClick={handleBulkProfileFetch}
                      disabled={profileTherapists.every(t => !t.hp_url)}
                      className="px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-xl hover:bg-indigo-100 disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      一括自動入力 ({profileTherapists.filter(t => t.hp_url).length}人)
                    </button>
                  )
                )}
                <button
                  onClick={loadProfileTherapists}
                  disabled={profileLoading}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {profileLoading ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>読み込み中</>
                  ) : '再読み込み'}
                </button>
              </div>
            </div>

            {profileError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm">{profileError}</div>
            )}

            {profileTherapists.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">
                    {profileTherapists.length}人が未入力項目あり
                  </span>
                </div>

                <ul className="divide-y divide-slate-100">
                  {profileTherapists.map(t => {
                    const missingFields = [
                      !t.editAge && '年齢',
                      !t.editHeight && '身長',
                      (!t.editBust || !t.editBustCup) && 'スリーサイズ',
                      !t.editComment && 'コメント',
                    ].filter(Boolean)
                    return (
                      <li key={t.id} className={`p-4 ${t.status === 'fetching' ? 'bg-indigo-50' : t.status === 'error' ? 'bg-rose-50' : ''}`}>
                        {/* ヘッダー行 */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-800">{t.name}</span>
                            {t.hp_url && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-bold">HP</span>
                            )}
                            {missingFields.length > 0 && (
                              <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                未入力: {missingFields.join(' · ')}
                              </span>
                            )}
                            {t.status === 'fetching' && (
                              <svg className="w-4 h-4 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            )}
                            {t.status === 'error' && (
                              <span className="text-xs text-rose-600">{t.errorMsg}</span>
                            )}
                          </div>
                          {t.hp_url && t.status !== 'fetching' && !profileBulkFetching && (
                            <button
                              onClick={() => fetchProfileData(t.id)}
                              className="px-3 py-1 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 flex items-center gap-1 flex-shrink-0"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              自動入力
                            </button>
                          )}
                        </div>

                        {/* フィールド入力 */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-0.5">年齢</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={t.editAge}
                                onChange={e => updateProfileField(t.id, 'editAge', e.target.value)}
                                placeholder="22"
                                className={`w-full px-2 py-1.5 rounded-lg border text-sm outline-none focus:ring-1 focus:ring-indigo-400 ${!t.editAge ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}
                              />
                              {t.editAge && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">歳</span>}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-0.5">身長</label>
                            <div className="relative">
                              <input
                                type="number"
                                value={t.editHeight}
                                onChange={e => updateProfileField(t.id, 'editHeight', e.target.value)}
                                placeholder="158"
                                className={`w-full px-2 py-1.5 rounded-lg border text-sm outline-none focus:ring-1 focus:ring-indigo-400 ${!t.editHeight ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}
                              />
                              {t.editHeight && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">cm</span>}
                            </div>
                          </div>
                          <div className="flex gap-1 col-span-2 sm:col-span-2">
                            <div className="flex-1">
                              <label className="block text-[11px] text-slate-400 mb-0.5">バスト</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  value={t.editBust}
                                  onChange={e => updateProfileField(t.id, 'editBust', e.target.value)}
                                  placeholder="86"
                                  className={`w-full px-2 py-1.5 rounded-lg border text-sm outline-none focus:ring-1 focus:ring-indigo-400 ${!t.editBust ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}
                                />
                                {t.editBust && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">cm</span>}
                              </div>
                            </div>
                            <div className="w-16">
                              <label className="block text-[11px] text-slate-400 mb-0.5">カップ</label>
                              <input
                                type="text"
                                value={t.editBustCup}
                                onChange={e => updateProfileField(t.id, 'editBustCup', e.target.value)}
                                placeholder="D"
                                maxLength={2}
                                className={`w-full px-2 py-1.5 rounded-lg border text-sm outline-none focus:ring-1 focus:ring-indigo-400 ${!t.editBustCup ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-[11px] text-slate-400 mb-0.5">ウエスト</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  value={t.editWaist}
                                  onChange={e => updateProfileField(t.id, 'editWaist', e.target.value)}
                                  placeholder="58"
                                  className={`w-full px-2 py-1.5 rounded-lg border text-sm outline-none focus:ring-1 focus:ring-indigo-400 ${!t.editWaist ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}
                                />
                                {t.editWaist && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">cm</span>}
                              </div>
                            </div>
                            <div className="flex-1">
                              <label className="block text-[11px] text-slate-400 mb-0.5">ヒップ</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  value={t.editHip}
                                  onChange={e => updateProfileField(t.id, 'editHip', e.target.value)}
                                  placeholder="84"
                                  className={`w-full px-2 py-1.5 rounded-lg border text-sm outline-none focus:ring-1 focus:ring-indigo-400 ${!t.editHip ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}
                                />
                                {t.editHip && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">cm</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-0.5">コメント</label>
                          <textarea
                            value={t.editComment}
                            onChange={e => updateProfileField(t.id, 'editComment', e.target.value)}
                            rows={2}
                            placeholder="自己紹介・プロフィールコメントを入力"
                            className={`w-full px-2 py-1.5 rounded-lg border text-sm outline-none focus:ring-1 focus:ring-indigo-400 resize-none ${!t.editComment ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {/* 保存ボタン */}
                <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
                  {profileSaveMsg && (
                    <p className="text-sm text-green-600">{profileSaveMsg}</p>
                  )}
                  <button
                    onClick={handleSaveProfiles}
                    disabled={profileSaving || profileBulkFetching}
                    className="ml-auto px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {profileSaving ? (
                      <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>保存中...</>
                    ) : '変更を保存'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== 写真補完モード ===== */}
        {mode === 'add-photos' && (
          <div className="space-y-4">
            {/* URL入力 */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">セラピスト一覧ページのURL</label>
                <p className="text-xs text-slate-400 mb-3">HPの一覧ページを読み取り、登録済みセラピストと名前を照合して自動でURLを設定します。</p>
                {shopUrls && (shopUrls.hp_url || shopUrls.therapist_list_url || shopUrls.schedule_url) && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {shopUrls.hp_url && (
                      <button
                        type="button"
                        onClick={() => setPhotoModeUrl(shopUrls.hp_url)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${photoModeUrl === shopUrls.hp_url ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-400'}`}
                      >
                        HP
                      </button>
                    )}
                    {shopUrls.therapist_list_url && (
                      <button
                        type="button"
                        onClick={() => setPhotoModeUrl(shopUrls.therapist_list_url)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${photoModeUrl === shopUrls.therapist_list_url ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-400'}`}
                      >
                        セラピスト一覧
                      </button>
                    )}
                    {shopUrls.schedule_url && (
                      <button
                        type="button"
                        onClick={() => setPhotoModeUrl(shopUrls.schedule_url)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${photoModeUrl === shopUrls.schedule_url ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-400'}`}
                      >
                        スケジュール
                      </button>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={photoModeUrl}
                    onChange={e => setPhotoModeUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePhotoScrape()}
                    placeholder="https://example.com/cast"
                    className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={handlePhotoScrape}
                    disabled={photoScraping || !photoModeUrl.trim()}
                    className="px-5 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap flex items-center gap-2"
                  >
                    {photoScraping ? (
                      <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>読み取り中...</>
                    ) : '読み取る'}
                  </button>
                </div>
              </div>
              {photoScrapeError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm">{photoScrapeError}</div>
              )}
            </div>

            {/* マッチング結果 */}
            {existingTherapists.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* ヘッダー */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                  <div className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-800">{existingTherapists.length}人</span> が写真未登録
                    {existingTherapists.filter(t => t.matched).length > 0 && (
                      <span className="ml-2 text-indigo-600 font-medium">
                        （HPと照合済み: {existingTherapists.filter(t => t.matched).length}人）
                      </span>
                    )}
                  </div>
                  {bulkFetching ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm text-indigo-600">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        {bulkProgress.done}/{bulkProgress.total}人完了
                      </div>
                      <button
                        onClick={() => { cancelBulk.current = true; setBulkFetching(false) }}
                        className="px-4 py-2 bg-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-300"
                      >
                        停止
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleBulkFetch}
                      disabled={existingTherapists.every(t => !t.inputUrl.trim() || t.status === 'done')}
                      className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      一括で写真を取得（{existingTherapists.filter(t => t.inputUrl.trim() && t.status !== 'done').length}人）
                    </button>
                  )}
                </div>

                {/* リスト */}
                <ul className="divide-y divide-slate-100">
                  {existingTherapists.map(t => (
                    <li key={t.id} className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                      t.status === 'done' ? 'bg-green-50' :
                      t.status === 'error' ? 'bg-rose-50' :
                      t.status === 'fetching' ? 'bg-indigo-50' : ''
                    }`}>
                      {/* サムネイル */}
                      <div className="w-10 h-14 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 relative">
                        {t.status === 'done' && t.photo_url ? (
                          <Image src={t.photo_url} alt={t.name} fill className="object-cover" unoptimized />
                        ) : t.status === 'fetching' ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                          {t.matched && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">HP照合済</span>
                          )}
                          {t.status === 'done' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">完了</span>
                          )}
                        </div>
                        {t.status === 'done' ? (
                          <p className="text-xs text-green-600">写真を登録しました</p>
                        ) : t.status === 'error' ? (
                          <p className="text-xs text-rose-600">{t.errorMsg}</p>
                        ) : (
                          <input
                            type="url"
                            value={t.inputUrl}
                            onChange={e => setExistingTherapists(prev => prev.map(p => p.id === t.id ? { ...p, inputUrl: e.target.value, matched: false } : p))}
                            placeholder="プロフィールページURLを入力（任意）"
                            disabled={t.status === 'fetching'}
                            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-400 outline-none disabled:opacity-50"
                          />
                        )}
                      </div>

                      <div className="flex-shrink-0 w-16 flex justify-center">
                        {t.status === 'done' ? (
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </div>
                        ) : t.status === 'fetching' ? (
                          <svg className="w-5 h-5 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        ) : (
                          <button
                            onClick={() => t.inputUrl.trim() && fetchPhotoForTherapist(t.id, t.inputUrl.trim())}
                            disabled={!t.inputUrl.trim() || bulkFetching}
                            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                          >
                            取得
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
