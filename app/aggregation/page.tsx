'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import { calculateBack, BackCalculationInput } from '@/lib/calculateBack'
import Link from 'next/link'

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
  start_time: string
  end_time: string
  credit_fee_amount: number
  course: { duration: number } | null
  reservation_options: { option_id: string; price: number }[]
  reservation_discounts: { applied_amount: number; burden_type: 'shop_only' | 'split' | 'therapist_only' }[]
}

export default function AggregationPage() {
  const { selectedShop } = useShop()
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    // 21日以降は翌月の集計期間に入るため、デフォルトで翌月を選択
    if (now.getDate() >= 21) {
      now.setMonth(now.getMonth() + 1)
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([])
  const [periodStr, setPeriodStr] = useState('')
  const [staffOnly, setStaffOnly] = useState(false)

  const handleCalculate = async () => {
    if (!selectedShop || !selectedMonth) return
    
    setLoading(true)
    setError(null)
    
    try {
      const [year, month] = selectedMonth.split('-').map(Number)
      
      const start = new Date(year, month - 2, 21)
      const end = new Date(year, month - 1, 20)
      
      const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-21`
      const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-20`
      
      setPeriodStr(`${startStr.replace(/-/g, '/')} 〜 ${endStr.replace(/-/g, '/')} (20日締め)`)

      const [{ data: resData, error: resError }, { data: therapists, error: therapistError }] = await Promise.all([
        supabase
          .from('reservations')
          .select(`
            *, credit_fee_amount,
            course:courses(duration),
            reservation_options(option_id, price),
            reservation_discounts(applied_amount, burden_type)
          `)
          .eq('shop_id', selectedShop.id)
          .gte('date', startStr)
          .lte('date', endStr)
          .neq('status', 'cancelled')
          .order('date', { ascending: true }),
        supabase
          .from('therapists')
          .select('id, name, rank_id, back_calc_type')
          .eq('shop_id', selectedShop.id)
      ])

      if (resError) throw resError
      if (therapistError) throw therapistError

      let reservations = (resData as unknown) as (ReservationWithDetails & { reception_source?: string })[]
      
      if (staffOnly) {
        reservations = reservations.filter(r => r.reception_source === 'staff')
      }

      const dailyMap: Record<string, ReservationWithDetails[]> = {}
      reservations.forEach(res => {
        if (!dailyMap[res.date]) dailyMap[res.date] = []
        dailyMap[res.date].push(res)
      })

      const results: DailySummary[] = []
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
          if (!therapist) continue

          const input: BackCalculationInput = {
            shopId: selectedShop.id,
            therapistId: therapist.id,
            therapistRankId: therapist.rank_id,
            therapistBackCalcType: therapist.back_calc_type,
            courseId: res.course_id,
            coursePrice: res.base_price || 0,
            courseDuration: res.course?.duration || 0,
            designationType: res.designation_type as any || 'free',
            nominationFee: res.nomination_fee || 0,
            options: res.reservation_options || [],
            discounts: res.reservation_discounts || [],
            discountAmount: res.discount_amount || 0,
            date: res.date,
            startTime: res.start_time
          }

          const calc = await calculateBack(input)
          const fee = res.credit_fee_amount || 0
          daySales += calc.totalPrice + fee
          dayBack += calc.netBack
          dayCreditFee += fee
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
    } catch (err: any) {
      console.error(err)
      setError('集計に失敗しました: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    handleCalculate()
  }, [selectedShop, selectedMonth, staffOnly])

  const totals = useMemo(() => {
    return dailySummaries.reduce((acc, cur) => ({
      sales: acc.sales + cur.totalSales,
      back: acc.back + cur.totalBack,
      profit: acc.profit + cur.shopProfit,
      count: acc.count + cur.reservationCount,
      creditFee: acc.creditFee + cur.totalCreditFee,
    }), { sales: 0, back: 0, profit: 0, count: 0, creditFee: 0 })
  }, [dailySummaries])

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
                <div className="flex items-center gap-1.5 line-clamp-1">
                  <span className="font-bold text-slate-700 font-mono text-xs">{day.date.slice(5).replace('-', '/')}</span>
                  <span className={`text-[9px] font-bold px-1 rounded ${
                    new Date(day.date).getDay() === 0 ? 'text-rose-500 bg-rose-50' : 
                    new Date(day.date).getDay() === 6 ? 'text-indigo-500 bg-indigo-50' : 'text-slate-400'
                  }`}>
                    {new Date(day.date).toLocaleDateString('ja-JP', { weekday: 'short' })}
                  </span>
                </div>
              </td>
              <td className="px-3 py-1.5 border-b border-slate-50 font-mono text-[11px] text-slate-600">¥{day.totalSales.toLocaleString()}</td>
              <td className="px-3 py-1.5 border-b border-slate-50 font-mono font-bold text-[11px] text-indigo-600">¥{day.totalBack.toLocaleString()}</td>
              <td className="px-3 py-1.5 border-b border-slate-50 font-mono font-bold text-[11px] text-emerald-600">¥{day.shopProfit.toLocaleString()}</td>
              <td className="px-3 py-1.5 border-b border-slate-50 hidden sm:table-cell">
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold">
                  {day.reservationCount}
                </span>
              </td>
              <td className="px-1 py-1 text-center border-b border-slate-50">
                <Link 
                  href={`/shifts?date=${day.date}`}
                  className="text-slate-300 hover:text-indigo-600 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">店舗集計レポート</h1>
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

        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200/60 transition-all">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative inline-flex items-center">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={staffOnly}
                    onChange={(e) => setStaffOnly(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
                </div>
                <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">スタッフ受付のみを集計</span>
              </label>
              <div className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Accountability Filter
              </div>
            </div>
            <div className="text-[11px] text-slate-400 font-medium bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
              ※顧客直接（WEB等）やセラピスト直接の予約を除外して、スタッフの貢献度を可視化します
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
          </div>
        </div>

        {/* 2列レイアウトの日別明細 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in duration-500">
          <div>{renderTable(leftHalf)}</div>
          <div>{renderTable(rightHalf)}</div>
        </div>

        {loading && (
          <div className="fixed inset-0 z-[60] bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
            <div className="bg-white p-6 rounded-2xl shadow-2xl border border-slate-200 flex items-center gap-4 animate-in fade-in zoom-in-95">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <div className="font-bold text-slate-700">集計しています...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
