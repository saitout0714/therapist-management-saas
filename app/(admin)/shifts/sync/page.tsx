'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type SyncType = 'caskan' | 'scraper'

interface SiteConfig {
  name: string
  label: string
}

const SITES: SiteConfig[] = [
  { name: '辻堂茅ヶ崎', label: '辻堂茅ヶ崎 (mens-esthe-tsujido.com)' },
  { name: 'ローズカフェ', label: 'ローズカフェ (rosecafe.men-este.com)' },
  { name: '淑女の秘密スパ', label: '淑女の秘密スパ (himitsuspa.com)' },
  { name: 'アーバンスパ', label: 'アーバンスパ (urbanspa.jp)' },
  { name: '新宿秘密妻', label: '新宿秘密妻 (himitsuma.com)' },
  { name: 'クイーン広島', label: 'クイーン広島 (hiroshima-queen.com)' },
]

interface ShopConfig {
  name: string
  label: string
  caskanId: number
  supabaseId: string
}

const CAS_SHOPS: ShopConfig[] = [
  { name: "noel", label: "noel", caskanId: 1055, supabaseId: "0ffa0c56-c61f-4e41-95a2-8ec3028eefdc" },
  { name: "aroma", label: "aroma", caskanId: 1112, supabaseId: "d45829ba-a7e3-48d8-8b09-5e49b9f494a7" },
  { name: "rabbit_tachikawa", label: "rabbit_tachikawa", caskanId: 1631, supabaseId: "a0000001-0000-0000-0000-000000000003" },
  { name: "rabbit_machida", label: "rabbit_machida", caskanId: 1772, supabaseId: "933b0d5a-d436-453d-a8bc-8741a74a52c9" },
  { name: "secret_moment", label: "secret_moment", caskanId: 1823, supabaseId: "a0000001-0000-0000-0000-000000000002" },
  { name: "spa_rich", label: "spa_rich", caskanId: 1857, supabaseId: "a0000001-0000-0000-0000-000000000001" },
  { name: "kamigami", label: "kamigami", caskanId: 1971, supabaseId: "3d4e98bd-ed3f-4bea-8327-4891d65c427c" },
]

export default function SyncPage() {
  const [syncType, setSyncType] = useState<SyncType>('caskan')
  const [startDate, setStartDate] = useState<string>('')
  const [days, setDays] = useState<number>(1)
  const [weeks, setWeeks] = useState<number>(1)
  const [selectedSites, setSelectedSites] = useState<string[]>(SITES.map((s) => s.name))
  const [selectedShops, setSelectedShops] = useState<string[]>(CAS_SHOPS.map((s) => s.name))
  const [dryRun, setDryRun] = useState<boolean>(true)
  const [update, setUpdate] = useState<boolean>(true)
  const [delShifts, setDelShifts] = useState<boolean>(false)
  const [force, setForce] = useState<boolean>(false)

  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [logs, setLogs] = useState<string>('')
  const consoleEndRef = useRef<HTMLDivElement>(null)

  const [dbShops, setDbShops] = useState<Record<string, string>>({})

  // Set default start date to today's date in YYYY-MM-DD
  useEffect(() => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    setStartDate(`${yyyy}-${mm}-${dd}`)
  }, [])

  // Fetch shop names from Supabase
  useEffect(() => {
    async function loadShops() {
      const { data, error } = await supabase.from('shops').select('id, name')
      if (data && !error) {
        const mapping: Record<string, string> = {}
        data.forEach((s: any) => {
          mapping[s.id] = s.name
        })
        setDbShops(mapping)
      }
    }
    void loadShops()
  }, [])

  // Auto-scroll logs
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  const toggleSite = (siteName: string) => {
    setSelectedSites((prev) =>
      prev.includes(siteName)
        ? prev.filter((name) => name !== siteName)
        : [...prev, siteName]
    )
  };

  const toggleShop = (shopName: string) => {
    setSelectedShops((prev) =>
      prev.includes(shopName)
        ? prev.filter((name) => name !== shopName)
        : [...prev, shopName]
    )
  };

  const handleStartSync = async () => {
    if (isRunning) return
    setIsRunning(true)
    setLogs('')

    const payload = {
      syncType,
      date: startDate,
      dryRun,
      force,
      ...(syncType === 'caskan'
        ? { weeks, shops: selectedShops }
        : { days, update, delete: delShifts, sites: selectedSites }),
    }

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errText = await response.text()
        let errMsg = errText
        try {
          const errJson = JSON.parse(errText)
          errMsg = errJson.error || errText
        } catch {}
        setLogs(`[ERROR] 同期の起動に失敗しました: ${errMsg}\n`)
        setIsRunning(false)
        return
      }

      if (!response.body) {
        setLogs('[ERROR] レスポンスストリームの取得に失敗しました。\n')
        setIsRunning(false)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        setLogs((prev) => prev + text)
      }
    } catch (err: any) {
      setLogs((prev) => prev + `\n[SYSTEM ERROR] 通信エラー: ${err.message || err}\n`)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="bg-gray-100 min-h-screen p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.23" />
              </svg>
              外部シフト同期
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              キャスカンまたは各店舗ホームページからシフト情報を取得し、システムと同期します。
            </p>
          </div>
          <Link
            href="/shifts"
            className="self-start sm:self-center px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm transition-colors shadow-sm"
          >
            スケジュールに戻る
          </Link>
        </div>

        {/* Sync Type Selector */}
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setSyncType('caskan')}
            className={`p-4 rounded-2xl border text-left transition-all duration-300 ${
              syncType === 'caskan'
                ? 'bg-white border-indigo-600 ring-2 ring-indigo-600/20 shadow-md'
                : 'bg-white border-slate-200 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${syncType === 'caskan' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                <span className="font-bold text-sm">C</span>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">キャスカン同期</h3>
                <p className="text-xs text-slate-500">週単位でキャストスケジュールを取得</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSyncType('scraper')}
            className={`p-4 rounded-2xl border text-left transition-all duration-300 ${
              syncType === 'scraper'
                ? 'bg-white border-indigo-600 ring-2 ring-indigo-600/20 shadow-md'
                : 'bg-white border-slate-200 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${syncType === 'scraper' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                <span className="font-bold text-sm">S</span>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">サイトスクレイピング同期</h3>
                <p className="text-xs text-slate-500">店舗HPの出勤情報から日単位で取得</p>
              </div>
            </div>
          </button>
        </div>

        {/* Configurations Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6 space-y-6">
          <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3">同期パラメータ設定</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Common fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">同期開始日</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
                />
              </div>

              {syncType === 'caskan' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">同期する週数 ({weeks} 週間)</label>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    value={weeks}
                    onChange={(e) => setWeeks(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-2"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1 px-1">
                    <span>1週間</span>
                    <span>2週間</span>
                    <span>3週間</span>
                    <span>4週間</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">同期する日数 ({days} 日間)</label>
                  <input
                    type="range"
                    min="1"
                    max="14"
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-2"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1 px-1">
                    <span>1日</span>
                    <span>7日</span>
                    <span>14日</span>
                  </div>
                </div>
              )}
            </div>

            {/* Checkboxes / Toggles */}
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">実行オプション</label>

              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">テスト実行 (Dry Run)</span>
                    <span className="text-[10px] text-slate-500">データを書き換えずに、追加・削除・更新対象をログに出力します。</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={force}
                    onChange={(e) => setForce(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">過去・当日日付の同期強制 (Force)</span>
                    <span className="text-[10px] text-slate-500">通常スキップされる過去・当日のシフト情報を強制的に上書き同期します。</span>
                  </div>
                </label>

                {syncType === 'scraper' && (
                  <>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={update}
                        onChange={(e) => setUpdate(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-700 block">既存シフト更新 (Update)</span>
                        <span className="text-[10px] text-slate-500">登録済みシフトと差分がある場合、時間やルームを上書き更新します。</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={delShifts}
                        onChange={(e) => setDelShifts(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-700 block">消滅シフト削除 (Delete)</span>
                        <span className="text-[10px] text-slate-500">サイト上に存在しないシフトをSupabaseデータベースから削除します。</span>
                      </div>
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Caskan target shops list */}
          {syncType === 'caskan' && (
            <div className="border-t border-slate-100 pt-5">
              <label className="block text-xs font-semibold text-slate-600 mb-2.5">対象店舗選択（同期対象）</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {CAS_SHOPS.map((shop) => (
                  <label
                    key={shop.name}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      selectedShops.includes(shop.name)
                        ? 'border-indigo-200 bg-indigo-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedShops.includes(shop.name)}
                      onChange={() => toggleShop(shop.name)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold block truncate text-slate-700">{dbShops[shop.supabaseId] || shop.label}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Site selection filter (for scraper) */}
          {syncType === 'scraper' && (
            <div className="border-t border-slate-100 pt-5">
              <label className="block text-xs font-semibold text-slate-600 mb-2.5">対象サイト選択（同期対象）</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SITES.map((site) => (
                  <label
                    key={site.name}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      selectedSites.includes(site.name)
                        ? 'border-indigo-200 bg-indigo-50/50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSites.includes(site.name)}
                      onChange={() => toggleSite(site.name)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="text-xs font-medium text-slate-700">{site.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Sync Trigger Action */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-5">
            <div className="flex items-center gap-2">
              {isRunning ? (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
                  同期実行中...
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200">
                  <span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-2"></span>
                  待機中
                </span>
              )}
              {dryRun && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  テストモード (シミュレーション)
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={
                isRunning || 
                (syncType === 'scraper' && selectedSites.length === 0) ||
                (syncType === 'caskan' && selectedShops.length === 0)
              }
              onClick={handleStartSync}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
            >
              {isRunning ? '実行中...' : '同期を開始する'}
            </button>
          </div>
        </div>

        {/* Real-time terminal log viewer */}
        <div className="bg-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col">
          <div className="bg-slate-950 px-4 py-3 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block"></span>
                <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block"></span>
              </span>
              <span className="text-xs text-slate-400 font-mono ml-2">Console Output</span>
            </div>
            <button
              onClick={() => setLogs('')}
              className="text-[10px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors px-2.5 py-1.5 rounded font-mono"
            >
              Clear Logs
            </button>
          </div>
          <div className="p-4 font-mono text-xs text-slate-300 overflow-y-auto max-h-96 min-h-[200px] whitespace-pre-wrap leading-relaxed select-text bg-slate-900 scrollbar-thin scrollbar-thumb-slate-800">
            {logs ? logs : '[SYSTEM] 同期を開始すると、こちらにリアルタイムのログが表示されます。\n'}
            <div ref={consoleEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
