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
    <div className="bg-slate-50 min-h-screen p-1.5 md:p-3">
      <div className="w-full max-w-full space-y-3">
        
        {/* ヘッダーセクション */}
        <div className="flex flex-row items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200/60 shadow-sm">
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition-all"
              title="店舗管理に戻る"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-base font-black text-slate-800 tracking-tight leading-none">代行プラン集計</h1>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">mts代理受付の予約（代行予約）日次集計（20日締め固定）</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <input 
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all text-xs font-bold text-slate-700 cursor-pointer"
            />
            <button 
              onClick={fetchData}
              disabled={loading}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-50 text-xs"
            >
              更新
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        {/* 概要インフォバー (省スペース化) */}
        {matrixData && (
          <div className="flex flex-wrap items-center gap-4 bg-white px-3 py-2 rounded-xl border border-slate-200/60 shadow-sm text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold">総代行予約数:</span>
              <span className="font-bold text-indigo-600 font-mono text-sm">{matrixData.grandTotal} 件</span>
            </div>
            <div className="h-3 w-px bg-slate-200 hidden sm:block"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold">集計対象店舗数:</span>
              <span className="font-bold text-slate-700 font-mono text-sm">{shops.length} 店舗</span>
            </div>
            <div className="h-3 w-px bg-slate-200 hidden md:block"></div>
            <div className="text-[10px] font-mono font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded px-2 py-0.5 ml-auto">
              集計期間: {matrixData.periodStr}
            </div>
          </div>
        )}

        {/* 集計テーブル表示 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-bold text-slate-500 animate-pulse">集計しています...</span>
          </div>
        ) : !matrixData ? (
          <div className="bg-white p-8 text-center rounded-xl border border-slate-200/60 shadow-sm text-slate-400 font-medium text-xs">
            集計データが存在しません。年月を変更してください。
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden animate-in fade-in duration-200">
            
            {/* スプレッドシートマトリクステーブル */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-black text-slate-500 uppercase tracking-tight">
                    <th className="px-2 py-1.5 border-r border-slate-200 text-center w-20 whitespace-nowrap bg-slate-50 font-bold sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">日付</th>
                    {shops.map(shop => (
                      <th key={shop.id} className="px-1.5 py-1.5 border-r border-slate-200 text-center font-bold text-slate-700 min-w-[65px] max-w-[120px] truncate" title={shop.name}>
                        {shop.name}
                      </th>
                    ))}
                    <th className="px-2 py-1.5 text-center bg-indigo-50/50 text-indigo-800 font-bold w-20 whitespace-nowrap">合計</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[10px]">
                  {matrixData.dates.map((dateStr) => {
                    const dateObj = new Date(dateStr)
                    const isSunday = dateObj.getDay() === 0
                    const isSaturday = dateObj.getDay() === 6
                    
                    return (
                      <tr key={dateStr} className="hover:bg-slate-50/70 transition-colors">
                        {/* 日付列 */}
                        <td className={`px-2 py-1 border-r border-slate-200 text-center font-bold font-mono whitespace-nowrap sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)] ${
                          isSunday ? 'text-rose-600 bg-rose-50/30' :
                          isSaturday ? 'text-indigo-600 bg-indigo-50/30' : 'text-slate-500 bg-white'
                        }`}>
                          <span className="mr-0.5">{dateStr.slice(5).replace('-', '/')}</span>
                          <span>({dateObj.toLocaleDateString('ja-JP', { weekday: 'short' })})</span>
                        </td>

                        {/* 各店舗のカウントセル */}
                        {shops.map(shop => {
                          const count = matrixData.matrix[dateStr]?.[shop.id] || 0
                          return (
                            <td key={shop.id} className={`px-1.5 py-1 border-r border-slate-200 text-center font-mono font-semibold ${
                              count > 0 ? 'text-slate-900 font-bold bg-amber-50/30' : 'text-slate-300'
                            }`}>
                              {count > 0 ? count : '-'}
                            </td>
                          )
                        })}

                        {/* 日次合計 */}
                        <td className="px-2 py-1 text-center font-mono font-black text-indigo-700 bg-indigo-50/30 whitespace-nowrap">
                          {matrixData.dateTotals[dateStr] || 0}
                        </td>
                      </tr>
                    )
                  })}

                  {/* 小計行 */}
                  <tr className="bg-indigo-50/30 border-t-2 border-slate-200 text-[11px] font-black">
                    <td className="px-2 py-2 border-r border-slate-200 text-center text-slate-600 font-bold sticky left-0 z-10 bg-indigo-50/30 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">小計</td>
                    {shops.map(shop => (
                      <td key={shop.id} className="px-1.5 py-2 border-r border-slate-200 text-center font-mono text-slate-900 font-black text-xs">
                        {matrixData.shopTotals[shop.id] || 0}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center font-mono text-indigo-800 bg-indigo-100/50 font-black text-xs">
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
