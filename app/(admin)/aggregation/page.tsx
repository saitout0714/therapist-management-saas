'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import Link from 'next/link'
import { toDisplayTime } from '@/lib/timeUtils'

interface DailySummary {
  date: string;
  totalSales: number;
  totalBack: number;
  shopProfit: number;
  reservationCount: number;
  totalCreditFee: number;
}

interface ReservationWithDetails {
  id: string
  therapist_id: string
  course_id: string
  base_price: number
  nomination_fee: number
  discount_amount: number
  designation_type: string
  date: string
  business_date?: string | null
  start_time: string
  end_time: string
  extension_count: number
  credit_fee_amount: number
  total_price: number | null
  therapist_back_amount: number | null
  shop_revenue: number | null
  course: { name: string; duration: number; base_price: number; back_amount: number } | null
  reservation_options: { option_id: string | null; price: number; custom_name?: string | null; option?: { name: string } | null }[]
  reservation_discounts: { applied_amount: number; burden_type: 'shop_only' | 'split' | 'therapist_only' }[]
  customer?: { name: string } | null
  reception_source?: string | null
}

interface CalculatedReservation extends ReservationWithDetails {
  therapistName: string
  calculatedTotalPrice: number
  calculatedNetBack: number
  calculatedShopProfit: number
}export default function AggregationPage() {
  const { selectedShop, refreshShops } = useShop()
  const [closingDate, setClosingDate] = useState<number>(20)
  const [savingClosingDate, setSavingClosingDate] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([])
  const [calculatedReservations, setCalculatedReservations] = useState<CalculatedReservation[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [periodStr, setPeriodStr] = useState('')

  // Update closingDate and selectedMonth when selectedShop loads/changes
  useEffect(() => {
    if (selectedShop) {
      const dbClosingDate = (selectedShop as any).closing_date ?? 20
      setClosingDate(dbClosingDate)
      
      const now = new Date()
      if (dbClosingDate !== 31 && now.getDate() > dbClosingDate) {
        now.setMonth(now.getMonth() + 1)
      }
      setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    }
  }, [selectedShop])

  // 時間文字列を営業日の時系列順ソート用の数値に変換（朝6:00以降を翌日5:59まで並べる）
  const timeToSortValue = (timeStr: string): number => {
    if (!timeStr) return 9999
    const [h, m] = timeStr.split(':').map(Number)
    const adjustedH = h < 6 ? h + 24 : h
    return adjustedH * 60 + (m || 0)
  }

  const handleClosingDateChange = async (newVal: number) => {
    if (!selectedShop) return
    setClosingDate(newVal)
    setSavingClosingDate(true)
    try {
      const { error } = await supabase
        .from('shops')
        .update({ closing_date: newVal })
        .eq('id', selectedShop.id)
      
      if (error) throw error
      if (refreshShops) {
        await refreshShops()
      }
    } catch (err: any) {
      console.error('締め日の保存に失敗しました:', err)
      alert('締め日の保存に失敗しました: ' + err.message)
    } finally {
      setSavingClosingDate(false)
    }
  }

  const handleCalculate = async () => {
    if (!selectedShop || !selectedMonth) return
    
    setLoading(true)
    setError(null)
    
    try {
      const [year, month] = selectedMonth.split('-').map(Number)
      
      let start: Date
      let end: Date
      let startStr = ''
      let endStr = ''

      if (closingDate === 31) {
        // 月末締め: 対象月の 1日 〜 末日
        start = new Date(year, month - 1, 1)
        end = new Date(year, month, 0)
        startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
        endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
        setPeriodStr(`${startStr.replace(/-/g, '/')} 〜 ${endStr.replace(/-/g, '/')} (月末締め)`)
      } else {
        // 通常締め (1〜30)
        start = new Date(year, month - 2, closingDate + 1)
        end = new Date(year, month - 1, closingDate)
        startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
        endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
        setPeriodStr(`${startStr.replace(/-/g, '/')} 〜 ${endStr.replace(/-/g, '/')} (${closingDate}日締め)`)
      }

      const [{ data: resData, error: resError }, { data: therapists, error: therapistError }] = await Promise.all([
        supabase
          .from('reservations')
          .select(`
            *, credit_fee_amount,
            course:courses(name, duration, base_price, back_amount),
            reservation_options(option_id, price, custom_name, option:options(name)),
            reservation_discounts(applied_amount, burden_type),
            customer:customers(name)
          `)
          .eq('shop_id', selectedShop.id)
          .or(`and(business_date.gte.${startStr},business_date.lte.${endStr}),and(business_date.is.null,date.gte.${startStr},date.lte.${endStr})`)
          .neq('status', 'cancelled')
          .neq('status', 'blocked')
          .order('date', { ascending: true }),
        supabase
          .from('therapists')
          .select('id, name, rank_id, back_calc_type')
          .eq('shop_id', selectedShop.id)
      ])

      if (resError) throw resError
      if (therapistError) throw therapistError

      const reservations = (resData as unknown) as (ReservationWithDetails & { reception_source?: string })[]
      
      const dailyMap: Record<string, ReservationWithDetails[]> = {}
      reservations.forEach(res => {
        const targetDate = res.business_date || res.date
        if (!dailyMap[targetDate]) dailyMap[targetDate] = []
        dailyMap[targetDate].push(res)
      })

      const results: DailySummary[] = []
      const calculatedResList: CalculatedReservation[] = []
      const current = new Date(start)
      while (current <= end) {
        const dStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
        const dayRes = dailyMap[dStr] || []
        
        let daySales = 0
        let dayBack = 0
        let dayCount = dayRes.length
        let dayCreditFee = 0

        for (const res of dayRes) {
          const therapist = therapists?.find(t => t.id === res.therapist_id)
          const fee = res.credit_fee_amount || 0
          dayCreditFee += fee

          // すでに計算されDBに保存されている値を優先使用（N+1問題を回避）
          let calculatedTotalPrice = res.total_price
          if (calculatedTotalPrice === null || calculatedTotalPrice === undefined) {
            const totalOptionsPrice = res.reservation_options?.reduce((sum, o) => sum + (o.price || 0), 0) || 0
            const totalDiscount = res.reservation_discounts?.reduce((sum, d) => sum + d.applied_amount, 0) || res.discount_amount || 0
            const basePrice = res.base_price || 0
            const nominationFee = res.nomination_fee || 0
            calculatedTotalPrice = Math.max(0, basePrice + totalOptionsPrice + nominationFee - totalDiscount)
          }

          const calculatedNetBack = res.therapist_back_amount ?? 0

          daySales += calculatedTotalPrice
          dayBack += calculatedNetBack

          calculatedResList.push({
            ...res,
            therapistName: therapist ? therapist.name : '（未割当）',
            calculatedTotalPrice,
            calculatedNetBack,
            calculatedShopProfit: calculatedTotalPrice - calculatedNetBack,
          })
        }

        results.push({
          date: dStr,
          totalSales: daySales,
          totalBack: dayBack,
          shopProfit: daySales - dayBack,
          reservationCount: dayCount,
          totalCreditFee: dayCreditFee,
        })

        current.setDate(current.getDate() + 1)
      }

      setDailySummaries(results)
      setCalculatedReservations(calculatedResList)
    } catch (err: any) {
      console.error(err)
      setError('集計に失敗しました: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    handleCalculate()
  }, [selectedShop, selectedMonth, closingDate])

  const totals = useMemo(() => {
    let sales = 0
    let back = 0
    let profit = 0
    let count = 0
    let creditFee = 0
    let mtsCount = 0
    let ownerCount = 0
    let therapistCount = 0
    let clientCount = 0

    dailySummaries.forEach(cur => {
      sales += cur.totalSales
      back += cur.totalBack
      profit += cur.shopProfit
      count += cur.reservationCount
      creditFee += cur.totalCreditFee
    })

    calculatedReservations.forEach(res => {
      if (res.reception_source === 'staff') {
        mtsCount++
      } else if (res.reception_source === 'owner') {
        ownerCount++
      } else if (res.reception_source === 'therapist') {
        therapistCount++
      } else {
        clientCount++
      }
    })

    return {
      sales,
      back,
      profit,
      count,
      creditFee,
      mtsCount,
      ownerCount,
      therapistCount,
      clientCount
    }
  }, [dailySummaries, calculatedReservations])
  // 前半・後半への分割
  const half = Math.ceil(dailySummaries.length / 2)
  const leftHalf = dailySummaries.slice(0, half)
  const rightHalf = dailySummaries.slice(half)

  const renderTable = (data: DailySummary[]) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50">
          <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <th className="px-3 py-2 border-b border-slate-100">日付</th>
            <th className="px-3 py-2 border-b border-slate-100">売上</th>
            <th className="px-3 py-2 border-b border-slate-100 text-indigo-600">報酬</th>
            <th className="px-3 py-2 border-b border-slate-100 text-emerald-600">利益</th>
            <th className="px-3 py-2 border-b border-slate-100 hidden sm:table-cell">件数</th>
            <th className="px-1 py-1 border-b border-slate-100 w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.map((day) => (
            <tr key={day.date} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-3 py-1.5 border-b border-slate-50">
                <div className="flex items-center gap-1.5 line-clamp-1 whitespace-nowrap">
                  <span className="font-bold text-slate-700 font-mono text-xs">{day.date.slice(5).replace('-', '/')}</span>
                  <span className={`text-[9px] font-bold px-1 rounded whitespace-nowrap ${
                    new Date(day.date).getDay() === 0 ? 'text-rose-500 bg-rose-50' : 
                    new Date(day.date).getDay() === 6 ? 'text-indigo-500 bg-indigo-50' : 'text-slate-400'
                  }`}>
                    {new Date(day.date).toLocaleDateString('ja-JP', { weekday: 'short' })}
                  </span>
                </div>
              </td>
              <td className="px-3 py-1.5 border-b border-slate-50 font-mono text-[11px] text-slate-600 whitespace-nowrap">¥{day.totalSales.toLocaleString()}</td>
              <td className="px-3 py-1.5 border-b border-slate-50 font-mono font-bold text-[11px] text-indigo-600 whitespace-nowrap">¥{day.totalBack.toLocaleString()}</td>
              <td className="px-3 py-1.5 border-b border-slate-50 font-mono font-bold text-[11px] text-emerald-600 whitespace-nowrap">¥{day.shopProfit.toLocaleString()}</td>
              <td className="px-3 py-1.5 border-b border-slate-50 hidden sm:table-cell whitespace-nowrap">
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold">
                  {day.reservationCount}
                </span>
              </td>
              <td className="px-1 py-1 text-center border-b border-slate-50">
                <button 
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className="text-slate-300 hover:text-indigo-600 transition-colors p-1"
                  title="詳細明細を表示（日報）"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="bg-slate-50 p-4 md:p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">集計レポート</h1>
            <div className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-mono text-slate-600 shadow-sm">
              {periodStr || '---'}
            </div>
          </div>
          <div className="flex gap-2">
            <input 
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all text-xs font-bold"
            />
            <button 
              onClick={handleCalculate}
              disabled={loading}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-50 text-xs"
            >
              更新
            </button>
          </div>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-200/60 transition-all">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">締め日の設定</label>
              <div className="relative">
                <select
                  value={closingDate}
                  onChange={(e) => handleClosingDateChange(Number(e.target.value))}
                  disabled={savingClosingDate || !selectedShop}
                  className="pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all text-xs font-bold text-slate-700 disabled:opacity-50 appearance-none cursor-pointer animate-none"
                >
                  <option value={5}>5日締め</option>
                  <option value={10}>10日締め</option>
                  <option value={15}>15日締め</option>
                  <option value={20}>20日締め</option>
                  <option value={25}>25日締め</option>
                  <option value={31}>月末締め</option>
                </select>
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {savingClosingDate && (
                <span className="text-[10px] text-indigo-600 font-medium animate-pulse">保存中...</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 font-medium bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
              ※締め日を変更すると、その店舗（クライアント）の集計期間が自動で更新され、データベースに保存されます。
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        {/* サマリー（超小型） */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-200/60">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">総売上</div>
            <div className="text-lg font-bold text-slate-800 font-mono">¥{totals.sales.toLocaleString()}</div>
            {totals.creditFee > 0 && (
              <div className="text-[10px] text-amber-500 font-medium mt-0.5">うち手数料 ¥{totals.creditFee.toLocaleString()}</div>
            )}
          </div>
          <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-200/60">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">報酬合計</div>
            <div className="text-lg font-bold text-indigo-600 font-mono">¥{totals.back.toLocaleString()}</div>
          </div>
          <div className="bg-emerald-600 p-3.5 rounded-xl shadow-lg border border-emerald-700">
            <div className="text-[10px] text-emerald-100 font-bold uppercase tracking-wider mb-0.5">店舗利益 (店落ち)</div>
            <div className="text-xl font-bold text-white font-mono">¥{totals.profit.toLocaleString()}</div>
          </div>
          <div className="bg-white p-3.5 rounded-xl shadow-sm border border-slate-200/60">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">総予約数</div>
            <div className="text-lg font-bold text-slate-600 font-mono tracking-tight">
              {totals.count} <span className="text-xs">件</span>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 space-y-1 font-medium">
              <div className="flex justify-between">
                <span>代行(mts):</span>
                <span className="font-bold text-slate-700 font-mono">{totals.mtsCount}件</span>
              </div>
              <div className="flex justify-between">
                <span>オーナー:</span>
                <span className="font-bold text-slate-700 font-mono">{totals.ownerCount}件</span>
              </div>
              <div className="flex justify-between">
                <span>姫予約:</span>
                <span className="font-bold text-slate-700 font-mono">{totals.therapistCount}件</span>
              </div>
              <div className="flex justify-between">
                <span>WEB/その他:</span>
                <span className="font-bold text-slate-700 font-mono">{totals.clientCount}件</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2列レイアウトの日別明細 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in duration-500">
          <div>{renderTable(leftHalf)}</div>
          <div>{renderTable(rightHalf)}</div>
        </div>

        {loading && (
          <div className="fixed inset-0 z-[60] bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-2xl border border-slate-200 flex items-center gap-4 animate-in fade-in zoom-in-95">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <div className="font-bold text-slate-700">集計しています...</div>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl shadow active:scale-95 transition-all z-10"
            >
              集計をキャンセルして戻る
            </Link>
          </div>
        )}
      </div>

      {/* 日別詳細モーダル（日報） */}
      {selectedDate && (() => {
        const dayReservations = calculatedReservations.filter(r => r.date === selectedDate)
        const summary = dailySummaries.find(d => d.date === selectedDate) || {
          totalSales: 0,
          totalBack: 0,
          shopProfit: 0,
          reservationCount: 0,
          totalCreditFee: 0
        }

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setSelectedDate(null)}
            />
            
            {/* Modal Body */}
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl relative z-10 flex flex-col max-h-[85vh] overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    店舗日報詳細 - {selectedDate.replace(/-/g, '/')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">当日の予約明細一覧と個別収支です。</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Day Summary Cards */}
              <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold block mb-0.5">売上合計</span>
                  <span className="text-base font-bold text-slate-800 font-mono">¥{summary.totalSales.toLocaleString()}</span>
                  {summary.totalCreditFee > 0 && (
                    <span className="text-[9px] text-amber-500 font-medium block">手数料 ¥{summary.totalCreditFee.toLocaleString()}</span>
                  )}
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold block mb-0.5">報酬合計</span>
                  <span className="text-base font-bold text-indigo-600 font-mono">¥{summary.totalBack.toLocaleString()}</span>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 shadow-sm">
                  <span className="text-[10px] text-emerald-600 font-bold block mb-0.5">店舗利益 (店落ち)</span>
                  <span className="text-base font-bold text-emerald-700 font-mono">¥{summary.shopProfit.toLocaleString()}</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold block mb-0.5">総予約数</span>
                  <span className="text-base font-bold text-slate-600 font-mono">{summary.reservationCount} 件</span>
                </div>
              </div>

              {/* Modal Content Scroll Area */}
              <div className="flex-1 overflow-y-auto p-6 min-h-[300px] space-y-6">
                {dayReservations.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm font-medium">
                    この日の予約データはありません
                  </div>
                ) : (() => {
                  // セラピストごとにグループ分け
                  const reservationsByTherapist: Record<string, CalculatedReservation[]> = {}
                  dayReservations.forEach(r => {
                    const name = r.therapistName
                    if (!reservationsByTherapist[name]) {
                      reservationsByTherapist[name] = []
                    }
                    reservationsByTherapist[name].push(r)
                  })

                  // 各セラピストの予約を時間順（start_time）にソート
                  Object.keys(reservationsByTherapist).forEach(name => {
                    reservationsByTherapist[name].sort((a, b) => timeToSortValue(a.start_time) - timeToSortValue(b.start_time))
                  })

                  // セラピストごとの出勤時間（最初の予約の開始時間）の早い順でソートしてレンダリング
                  return Object.entries(reservationsByTherapist)
                    .sort(([, listA], [, listB]) => {
                      const timeA = listA[0]?.start_time || '23:59:59'
                      const timeB = listB[0]?.start_time || '23:59:59'
                      return timeToSortValue(timeA) - timeToSortValue(timeB)
                    })
                    .map(([therapistName, list]) => {
                      const tSales = list.reduce((sum, r) => sum + r.calculatedTotalPrice, 0)
                      const tBack = list.reduce((sum, r) => sum + r.calculatedNetBack, 0)
                      const tProfit = tSales - tBack

                      return (
                        <div key={therapistName} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                          {/* セラピストセクションヘッダー */}
                          <div className="bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                              <span className="font-bold text-slate-800 text-sm">{therapistName}</span>
                              <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                                {list.length}件
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-mono font-bold">
                              <span className="text-slate-500">売上: <span className="text-slate-700">¥{tSales.toLocaleString()}</span></span>
                              <span className="text-indigo-600">報酬: <span>¥{tBack.toLocaleString()}</span></span>
                              <span className="text-emerald-600">利益: <span>¥{tProfit.toLocaleString()}</span></span>
                            </div>
                          </div>

                          {/* セラピストの予約一覧テーブル */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs min-w-[650px]">
                              <thead className="bg-slate-50/50">
                                <tr className="text-slate-400 font-bold border-b border-slate-100 text-[10px] uppercase tracking-wider">
                                  <th className="px-4 py-2 min-w-[70px] whitespace-nowrap">時間</th>
                                  <th className="px-4 py-2 min-w-[80px] whitespace-nowrap">顧客</th>
                                  <th className="px-4 py-2 min-w-[160px] whitespace-nowrap">コース・オプション</th>
                                  <th className="px-4 py-2 text-right whitespace-nowrap">売上</th>
                                  <th className="px-4 py-2 text-right text-indigo-600 whitespace-nowrap">報酬</th>
                                  <th className="px-4 py-2 text-right text-emerald-600 whitespace-nowrap">利益</th>
                                  <th className="px-4 py-2 text-center w-20 whitespace-nowrap">操作</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {list.map((res) => {
                                  const optionNames = res.reservation_options
                                    ?.map(o => o.custom_name || o.option?.name || 'オプション')
                                    .filter(Boolean)
                                    .join(', ')

                                  return (
                                    <tr key={res.id} className="hover:bg-slate-50/40 transition-colors">
                                      <td className="px-4 py-2.5 font-mono font-semibold text-slate-600 whitespace-nowrap">
                                        {toDisplayTime(res.start_time)}〜{toDisplayTime(res.end_time)}
                                      </td>
                                      <td className="px-4 py-2.5 text-slate-500 font-medium truncate max-w-[120px] whitespace-nowrap">
                                        {res.customer?.name || 'ゲスト'}
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <div className="font-semibold text-slate-700 whitespace-nowrap">
                                          {res.course?.name || 'カスタムコース'}
                                          {res.course?.duration && ` (${res.course.duration}分)`}
                                        </div>
                                        {optionNames && (
                                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px] whitespace-nowrap" title={optionNames}>
                                            + {optionNames}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-700 whitespace-nowrap">
                                        ¥{res.calculatedTotalPrice.toLocaleString()}
                                      </td>
                                      <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-600 whitespace-nowrap">
                                        ¥{res.calculatedNetBack.toLocaleString()}
                                      </td>
                                      <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                                        ¥{res.calculatedShopProfit.toLocaleString()}
                                      </td>
                                      <td className="px-4 py-2.5 text-center whitespace-nowrap">
                                        <Link
                                          href={`/reservations/${res.id}`}
                                          target="_blank"
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-colors font-bold text-[10px]"
                                        >
                                          詳細
                                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                        </Link>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })
                })()}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/80 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="px-5 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors text-xs"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
