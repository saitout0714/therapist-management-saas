'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Shop {
  id: string
  name: string
  is_active: boolean
}

interface ReservationSummary {
  shop_id: string
  targetDate: string
}

export default function AgencyAggregationPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    // 21日以降は翌月の集計期間に入るため、デフォルトで翌月を選択
    if (now.getDate() >= 21) {
      now.setMonth(now.getMonth() + 1)
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const [shops, setShops] = useState<Shop[]>([])
  const [reservations, setReservations] = useState<ReservationSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    if (!selectedMonth) return
    setLoading(true)
    setError(null)

    try {
      const [year, month] = selectedMonth.split('-').map(Number)
      
      // 代行プランの締め日は常に20日締め（前月21日〜当月20日）
      const start = new Date(year, month - 2, 21)
      const end = new Date(year, month - 1, 20)
      
      const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-21`
      const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-20`

      const [{ data: shopData, error: shopError }, { data: resData, error: resError }] = await Promise.all([
        supabase
          .from('shops')
          .select('id, name, is_active')
          .eq('is_active', true)
          .order('order', { ascending: true, nullsFirst: false }),
        supabase
          .from('reservations')
          .select('shop_id, date, business_date, reception_source, status')
          .eq('reception_source', 'staff')
          .neq('status', 'cancelled')
          .neq('status', 'blocked')
          .or(`and(business_date.gte.${startStr},business_date.lte.${endStr}),and(business_date.is.null,date.gte.${startStr},date.lte.${endStr})`)
      ])

      if (shopError) throw shopError
      if (resError) throw resError

      setShops(shopData || [])

      const formattedReservations = (resData || []).map((res: any) => ({
        shop_id: res.shop_id,
        targetDate: res.business_date || res.date
      }))
      setReservations(formattedReservations)
    } catch (err: any) {
      console.error(err)
      setError('データの取得に失敗しました: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
  }, [selectedMonth])

  // 単一の20日締め期間での日付リストおよびマトリクスデータの生成
  const matrixData = useMemo(() => {
    if (shops.length === 0 || !selectedMonth) return null
    const [year, month] = selectedMonth.split('-').map(Number)

    // 20日締めの期間
    const start = new Date(year, month - 2, 21)
    const end = new Date(year, month - 1, 20)

    const dates: string[] = []
    const current = new Date(start)
    while (current <= end) {
      dates.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`)
      current.setDate(current.getDate() + 1)
    }

    const periodStr = `${dates[0]?.replace(/-/g, '/')} 〜 ${dates[dates.length - 1]?.replace(/-/g, '/')}`

    // matrix: Record<date, Record<shop_id, count>>
    const matrix: Record<string, Record<string, number>> = {}
    const shopTotals: Record<string, number> = {}
    const dateTotals: Record<string, number> = {}
    let grandTotal = 0

    // 初期化
    dates.forEach(dStr => {
      matrix[dStr] = {}
      shops.forEach(shop => {
        matrix[dStr][shop.id] = 0
        shopTotals[shop.id] = 0
      })
      dateTotals[dStr] = 0
    })

    // 予約の集計
    reservations.forEach(res => {
      if (matrix[res.targetDate] && matrix[res.targetDate][res.shop_id] !== undefined) {
        matrix[res.targetDate][res.shop_id]++
        shopTotals[res.shop_id] = (shopTotals[res.shop_id] || 0) + 1
        dateTotals[res.targetDate] = (dateTotals[res.targetDate] || 0) + 1
        grandTotal++
      }
    })

    return {
      periodStr,
      dates,
      matrix,
      shopTotals,
      dateTotals,
      grandTotal
    }
  }, [shops, reservations, selectedMonth])

  return (
    <div className="bg-slate-50 min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ヘッダーセクション */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-all shadow-sm"
              title="店舗管理に戻る"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">代行プラン集計</h1>
              <p className="text-xs text-slate-500 mt-0.5">mtsが代理受付した予約（代行予約）を店舗ごとに日次集計します（20日締め固定）。</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all text-sm font-bold text-slate-700 shadow-sm"
            />
            <button 
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 text-sm"
            >
              更新
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        {/* 概要カード */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
            <span className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">総代行予約件数</span>
            <span className="text-2xl font-bold text-indigo-600 font-mono">
              {matrixData?.grandTotal || 0} <span className="text-xs font-bold text-slate-500">件</span>
            </span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
            <span className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">集計対象店舗数</span>
            <span className="text-2xl font-bold text-slate-700 font-mono">
              {shops.length} <span className="text-xs font-bold text-slate-500">店舗</span>
            </span>
          </div>
        </div>

        {/* 集計テーブル表示 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-bold text-slate-500">集計しています...</span>
          </div>
        ) : !matrixData ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/60 shadow-sm text-slate-400 font-medium text-sm">
            集計データが存在しません。年月を変更してください。
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden animate-in fade-in duration-300">
            
            {/* グループヘッダー */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                <h3 className="font-bold text-slate-800 text-sm">クライアント別件数表 (20日締め)</h3>
              </div>
              <div className="text-xs font-mono font-bold text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1 shadow-inner">
                集計期間: {matrixData.periodStr}
              </div>
            </div>

            {/* スプレッドシートマトリクステーブル */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3 border-r border-slate-100/60 text-center w-28">日付</th>
                    {shops.map(shop => (
                      <th key={shop.id} className="px-3 py-3 border-r border-slate-100/60 text-center font-bold text-slate-700 min-w-[100px] truncate max-w-[150px]" title={shop.name}>
                        {shop.name}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center bg-indigo-50/30 text-indigo-700 font-bold w-24">合計</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {matrixData.dates.map((dateStr) => {
                    const dateObj = new Date(dateStr)
                    const isSunday = dateObj.getDay() === 0
                    const isSaturday = dateObj.getDay() === 6
                    
                    return (
                      <tr key={dateStr} className="hover:bg-slate-50/50 transition-colors">
                        {/* 日付列 */}
                        <td className={`px-4 py-2 border-r border-slate-100/60 text-center font-semibold font-mono whitespace-nowrap ${
                          isSunday ? 'text-rose-600 bg-rose-50/10' :
                          isSaturday ? 'text-indigo-600 bg-indigo-50/10' : 'text-slate-500'
                        }`}>
                          <span className="mr-1">{dateStr.slice(5).replace('-', '/')}</span>
                          <span>({dateObj.toLocaleDateString('ja-JP', { weekday: 'short' })})</span>
                        </td>

                        {/* 各店舗のカウントセル */}
                        {shops.map(shop => {
                          const count = matrixData.matrix[dateStr]?.[shop.id] || 0
                          return (
                            <td key={shop.id} className={`px-3 py-2 border-r border-slate-100/60 text-center font-mono font-semibold ${
                              count > 0 ? 'text-slate-800 font-bold bg-amber-50/20' : 'text-slate-300'
                            }`}>
                              {count > 0 ? count : '-'}
                            </td>
                          )
                        })}

                        {/* 日次合計 */}
                        <td className="px-4 py-2 text-center font-mono font-bold text-indigo-600 bg-indigo-50/10 whitespace-nowrap">
                          {matrixData.dateTotals[dateStr] || 0}
                        </td>
                      </tr>
                    )
                  })}

                  {/* 小計行 */}
                  <tr className="bg-indigo-50/25 border-t-2 border-slate-200 text-xs font-bold">
                    <td className="px-4 py-3 border-r border-slate-100/60 text-center text-slate-600 font-bold">小計</td>
                    {shops.map(shop => (
                      <td key={shop.id} className="px-3 py-3 border-r border-slate-100/60 text-center font-mono text-slate-800 font-bold text-sm">
                        {matrixData.shopTotals[shop.id] || 0}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center font-mono text-indigo-700 bg-indigo-50/60 font-bold text-sm">
                      {matrixData.grandTotal}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
