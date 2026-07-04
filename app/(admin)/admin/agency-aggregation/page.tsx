'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Shop {
  id: string
  name: string
  closing_date: number
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
      // 最も広い期間（前月1日〜当月末日）を一括取得
      const fetchStart = new Date(year, month - 2, 1)
      const fetchEnd = new Date(year, month, 0) // 当月末日
      
      const startStr = `${fetchStart.getFullYear()}-${String(fetchStart.getMonth() + 1).padStart(2, '0')}-01`
      const endStr = `${fetchEnd.getFullYear()}-${String(fetchEnd.getMonth() + 1).padStart(2, '0')}-${String(fetchEnd.getDate()).padStart(2, '0')}`

      const [{ data: shopData, error: shopError }, { data: resData, error: resError }] = await Promise.all([
        supabase
          .from('shops')
          .select('id, name, closing_date, is_active')
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

  // 各締め日グループに対する日付配列と、該当する予約件数計算ロジック
  const groupsData = useMemo(() => {
    if (shops.length === 0 || !selectedMonth) return []
    const [year, month] = selectedMonth.split('-').map(Number)

    // 締め日ごとに店舗をグループ化
    const groupsMap: Record<number, Shop[]> = {}
    shops.forEach(shop => {
      const cd = shop.closing_date ?? 20
      if (!groupsMap[cd]) groupsMap[cd] = []
      groupsMap[cd].push(shop)
    })

    // 各グループに対する日付とマトリクスデータを生成
    return Object.entries(groupsMap)
      .map(([closingStr, groupShops]) => {
        const closingDateVal = Number(closingStr)
        
        // 1) 期間内の各日を算出
        let start: Date
        let end: Date
        if (closingDateVal === 31) {
          start = new Date(year, month - 1, 1)
          end = new Date(year, month, 0)
        } else {
          start = new Date(year, month - 2, closingDateVal + 1)
          end = new Date(year, month - 1, closingDateVal)
        }

        const dates: string[] = []
        const current = new Date(start)
        while (current <= end) {
          dates.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`)
          current.setDate(current.getDate() + 1)
        }

        // 2) 各店舗、日付ごとの予約カウント
        // matrix: Record<date, Record<shop_id, count>>
        const matrix: Record<string, Record<string, number>> = {}
        const shopTotals: Record<string, number> = {}
        const dateTotals: Record<string, number> = {}
        let grandTotal = 0

        // 初期化
        dates.forEach(dStr => {
          matrix[dStr] = {}
          groupShops.forEach(shop => {
            matrix[dStr][shop.id] = 0
            shopTotals[shop.id] = 0
          })
          dateTotals[dStr] = 0
        })

        // 予約を集計
        reservations.forEach(res => {
          if (matrix[res.targetDate] && matrix[res.targetDate][res.shop_id] !== undefined) {
            matrix[res.targetDate][res.shop_id]++
            shopTotals[res.targetDate === res.targetDate ? res.shop_id : ''] = (shopTotals[res.shop_id] || 0) + 1
            dateTotals[res.targetDate] = (dateTotals[res.targetDate] || 0) + 1
            grandTotal++
          }
        })

        return {
          closingDate: closingDateVal,
          label: closingDateVal === 31 ? '月末締め' : `${closingDateVal}日締め`,
          periodStr: `${dates[0]?.replace(/-/g, '/')} 〜 ${dates[dates.length - 1]?.replace(/-/g, '/')}`,
          shops: groupShops,
          dates,
          matrix,
          shopTotals,
          dateTotals,
          grandTotal
        }
      })
      .sort((a, b) => a.closingDate - b.closingDate)
  }, [shops, reservations, selectedMonth])

  // 全グループをまたぐ総計
  const overallTotal = useMemo(() => {
    return groupsData.reduce((sum, g) => sum + g.grandTotal, 0)
  }, [groupsData])

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
              <p className="text-xs text-slate-500 mt-0.5">mtsが代理受付した予約（代行予約）を店舗ごとに日次集計します。</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
            <span className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">総代行予約件数</span>
            <span className="text-2xl font-bold text-indigo-600 font-mono">{overallTotal} <span className="text-xs font-bold text-slate-500">件</span></span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
            <span className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">集計対象店舗数</span>
            <span className="text-2xl font-bold text-slate-700 font-mono">{shops.length} <span className="text-xs font-bold text-slate-500">店舗</span></span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
            <span className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">締め日グループ数</span>
            <span className="text-2xl font-bold text-emerald-600 font-mono">{groupsData.length} <span className="text-xs font-bold text-slate-500">グループ</span></span>
          </div>
        </div>

        {/* 締め日グループ別のテーブル表示 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-bold text-slate-500">集計しています...</span>
          </div>
        ) : groupsData.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/60 shadow-sm text-slate-400 font-medium text-sm">
            集計データが存在しません。年月を変更してください。
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-300">
            {groupsData.map((group) => (
              <div key={group.closingDate} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                
                {/* グループヘッダー */}
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                    <h3 className="font-bold text-slate-800 text-sm">{group.label} グループ</h3>
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                      {group.shops.length}店舗
                    </span>
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1 shadow-inner">
                    集計期間: {group.periodStr}
                  </div>
                </div>

                {/* スプレッドシートマトリクステーブル */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-4 py-3 border-r border-slate-100/60 text-center w-28">日付</th>
                        {group.shops.map(shop => (
                          <th key={shop.id} className="px-3 py-3 border-r border-slate-100/60 text-center font-bold text-slate-700 min-w-[100px] truncate max-w-[150px]" title={shop.name}>
                            {shop.name}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-center bg-indigo-50/30 text-indigo-700 font-bold w-24">合計</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {group.dates.map((dateStr, rowIndex) => {
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
                            {group.shops.map(shop => {
                              const count = group.matrix[dateStr]?.[shop.id] || 0
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
                              {group.dateTotals[dateStr] || 0}
                            </td>
                          </tr>
                        )
                      })}

                      {/* 小計行 */}
                      <tr className="bg-indigo-50/25 border-t-2 border-slate-200 text-xs font-bold">
                        <td className="px-4 py-3 border-r border-slate-100/60 text-center text-slate-600 font-bold">小計</td>
                        {group.shops.map(shop => (
                          <td key={shop.id} className="px-3 py-3 border-r border-slate-100/60 text-center font-mono text-slate-800 font-bold text-sm">
                            {group.shopTotals[shop.id] || 0}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-center font-mono text-indigo-700 bg-indigo-50/60 font-bold text-sm">
                          {group.grandTotal}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
