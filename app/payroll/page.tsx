'use client'
/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import { calculateBack, calculateShiftAllowances, BackCalculationInput, BackCalculationResult } from '@/lib/calculateBack'

type TherapistItem = {
  id: string
  name: string
  rank_id: string | null
  back_calc_type: 'percentage' | 'fixed' | 'half_split' | null
}

type ReservationWithDetails = {
  id: string
  course_id: string
  base_price: number
  options_price: number
  nomination_fee: number
  discount_amount: number
  designation_type: string
  date: string
  start_time: string
  end_time: string
  extension_count: number
  payment_method: 'cash' | 'credit' | null
  options_payment_method: 'cash' | 'credit' | null
  credit_fee_amount: number
  // 計算済みバック額（予約登録時に保存されたもの）
  therapist_back_amount: number | null
  total_price: number | null
  shop_revenue: number | null
  back_calculated_at: string | null
  is_hime: boolean | null
  hime_bonus: number | null
  course: { name: string; duration: number; base_price: number; back_amount: number } | null
  customer: { name: string } | null
  reservation_options: { option_id: string | null; price: number; custom_name: string | null; custom_back_amount: number | null; option: { name: string } | null }[]
  reservation_discounts: { applied_amount: number; burden_type: 'shop_only' | 'split' | 'therapist_only' }[]
}

type CalculatedRow = {
  reservation: ReservationWithDetails
  result: BackCalculationResult
  fromCache: boolean // 予約登録時に計算済みかどうか
}

const getBusinessDate = () => {
  const now = new Date()
  // 朝6時前は前日の営業日
  if (now.getHours() < 6) {
    now.setDate(now.getDate() - 1)
  }
  return now.toLocaleDateString('ja-JP').split('/').join('-').replace(/\b\d\b/g, '0$&')
}

export default function PayrollPage() {
  const { selectedShop } = useShop()
  const [therapists, setTherapists] = useState<TherapistItem[]>([])

  // フォーム状態
  const [targetDate, setTargetDate] = useState<string>(getBusinessDate())
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('')
  const [extensionUnitMinutes, setExtensionUnitMinutes] = useState<number>(30)

  // 結果状態
  const [loading, setLoading] = useState(false)
  const [calculatedRows, setCalculatedRows] = useState<CalculatedRow[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shiftAllowance, setShiftAllowance] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function fetchTherapists() {
      if (!selectedShop || !targetDate) {
        setTherapists([])
        return
      }
      // 対象日に出勤しているセラピストのIDを取得
      const [shiftsRes, sysRes] = await Promise.all([
        supabase
          .from('shifts')
          .select('therapist_id')
          .eq('shop_id', selectedShop.id)
          .eq('date', targetDate),
        supabase
          .from('system_settings')
          .select('extension_unit_minutes')
          .eq('shop_id', selectedShop.id)
          .limit(1)
      ])

      if (sysRes.data && sysRes.data.length > 0) {
        setExtensionUnitMinutes(sysRes.data[0].extension_unit_minutes || 30)
      }

      const shiftData = shiftsRes.data

      const shiftTherapistIds = (shiftData || []).map((s: { therapist_id: string }) => s.therapist_id)
      if (shiftTherapistIds.length === 0) {
        setTherapists([])
        return
      }

      const { data, error } = await supabase
        .from('therapists')
        .select('id, name, rank_id, back_calc_type')
        .eq('shop_id', selectedShop.id)
        .in('id', shiftTherapistIds)
        .order('order', { ascending: true })

      if (!error && data) {
        setTherapists(data as TherapistItem[])
        // 現在選択中のセラピストが出勤していなければリセット
        if (selectedTherapistId && !shiftTherapistIds.includes(selectedTherapistId)) {
          setSelectedTherapistId('')
        }
      }
    }
    fetchTherapists()
  }, [selectedShop, targetDate])

  const handleCalculate = async (forceRecalculate = false) => {
    if (!selectedShop) return
    if (!selectedTherapistId) {
      setError('セラピストを選択してください')
      return
    }
    if (!targetDate) {
      setError('日付を選択してください')
      return
    }

    setError(null)
    setLoading(true)
    setHasSearched(false)

    try {
      const therapist = therapists.find(t => t.id === selectedTherapistId)
      if (!therapist) throw new Error('セラピストが見つかりません')

      const { data: resData, error: resError } = await supabase
        .from('reservations')
        .select(`
          id, course_id, base_price, options_price, nomination_fee, discount_amount, designation_type, date, start_time, end_time, extension_count, status, payment_method, options_payment_method, credit_fee_amount, therapist_back_amount, total_price, shop_revenue, back_calculated_at, is_hime, hime_bonus,
          course:courses(name, duration, base_price, back_amount),
          customer:customers(name),
          reservation_options(option_id, price, custom_name, custom_back_amount, option:options(name)),
          reservation_discounts(applied_amount, burden_type)
        `)
        .eq('shop_id', selectedShop.id)
        .eq('therapist_id', selectedTherapistId)
        .eq('date', targetDate)
        .neq('status', 'cancelled')
        .neq('status', 'blocked')
        .order('start_time', { ascending: true })

      if (resError) throw resError

      const reservations = (resData as unknown) as ReservationWithDetails[]

      const rows: CalculatedRow[] = []
      for (const res of reservations) {
        if (!res.course_id || !res.course) continue

        // 計算済みのバック額がある場合（再計算が不要な場合）
        if (!forceRecalculate && res.therapist_back_amount !== null && res.back_calculated_at) {
          // 簡易的なresult構築（計算済み値を使用）
          const totalOptionsPrice = res.reservation_options?.reduce((s, o) => s + o.price, 0) || 0
          const totalDiscount = res.reservation_discounts?.reduce((s, d) => s + d.applied_amount, 0) || res.discount_amount || 0
          const totalPrice = res.total_price !== null && res.total_price !== undefined ? res.total_price : Math.max(0, (res.base_price || 0) + totalOptionsPrice + (res.nomination_fee || 0) - totalDiscount)
          
          rows.push({
            reservation: res,
            result: {
              courseBack: 0, // 内訳は保存していないため詳細は再計算が必要
              extensionBack: 0,
              optionBack: 0,
              nominationBack: 0,
              totalBack: res.therapist_back_amount,
              deductions: 0,
              allowances: 0,
              netBack: res.therapist_back_amount,
              himeBonus: res.hime_bonus || 0,
              shopRevenue: res.shop_revenue || 0,
              totalPrice: Math.max(0, totalPrice),
              resolvedCustomerPrice: res.base_price || 0,
              totalDiscount: totalDiscount,
              therapistDiscountBurden: 0,
              businessDate: res.date,
              appliedRate: null,
              calcMethod: '予約登録時に計算済み',
            },
            fromCache: true,
          })
        } else {
          // 未計算 or 強制再計算 → calculateBack 実行
          const input: BackCalculationInput = {
            shopId: selectedShop.id,
            therapistId: therapist.id,
            therapistRankId: therapist.rank_id,
            therapistBackCalcType: therapist.back_calc_type,
            courseId: res.course_id,
            coursePrice: res.course?.base_price ?? res.base_price ?? 0,
            courseBackAmount: res.course?.back_amount || 0,
            courseDuration: res.course.duration || 0,
            designationType: res.designation_type || 'free',
            nominationFee: res.nomination_fee || 0,
            options: (res.reservation_options || []).map(o => ({
              option_id: o.option_id,
              price: o.price,
              custom_back_amount: o.custom_back_amount ?? undefined,
            })),
            discounts: res.reservation_discounts || [],
            discountAmount: res.discount_amount || 0,
            date: res.date,
            startTime: res.start_time,
            extensionCount: res.extension_count || 0,
            himeBonus: res.is_hime ? (res.hime_bonus || 0) : 0,
          }

          const result = await calculateBack(input)
          rows.push({ reservation: res, result, fromCache: false })

          // 計算結果をDBに保存（次回からキャッシュ）
          await supabase.from('reservations').update({
            therapist_back_amount: result.netBack,
            shop_revenue: result.shopRevenue,
            back_calculated_at: new Date().toISOString(),
            business_date: result.businessDate,
          }).eq('id', res.id)
        }
      }

      // シフトベースの手当（交通費等）を計算
      const allowance = await calculateShiftAllowances(selectedShop.id, selectedTherapistId, targetDate)
      setShiftAllowance(allowance)

      setCalculatedRows(rows)
      setHasSearched(true)
    } catch (err: any) {
      console.error(err)
      setError('計算処理中にエラーが発生しました: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const { totalSales, totalBack, totalDeductions, totalAllowances, totalHimeBonus, netPay, totalCashReceived, hasCreditReservation } = useMemo(() => {
    let sales = 0
    let back = 0
    let ded = 0
    let all = 0
    let hime = 0
    let netTotal = 0
    let cashReceived = 0
    let hasCredit = false

    calculatedRows.forEach(({ reservation: res, result }) => {
      sales += result.totalPrice
      back += result.totalBack
      ded += result.deductions
      all += result.allowances
      // himeBonus は予約レコードから直接取得（キャッシュ時の二重計上を防ぐ）
      hime += res.is_hime ? (res.hime_bonus || 0) : 0
      // netBack は両パスで正しく himeBonus・控除・手当を含む
      netTotal += result.netBack

      if (res.payment_method === 'credit') {
        hasCredit = true
        if (res.options_payment_method === 'cash') {
          cashReceived += res.options_price || 0
        }
      } else {
        cashReceived += result.totalPrice
      }
    })

    // シフト手当を加算
    all += shiftAllowance
    const net = netTotal + shiftAllowance

    return {
      totalSales: sales,
      totalBack: back,
      totalDeductions: ded,
      totalAllowances: all,
      totalHimeBonus: hime,
      netPay: net,
      totalCashReceived: cashReceived,
      hasCreditReservation: hasCredit,
    }
  }, [calculatedRows, shiftAllowance])

  const totalExtensionMinutes = useMemo(() => {
    const count = calculatedRows.reduce((sum, row) => sum + (row.reservation.extension_count || 0), 0)
    return count * extensionUnitMinutes
  }, [calculatedRows, extensionUnitMinutes])

  const designationLabel = (v: string) => {
    const map: Record<string, string> = { free: 'フリー', nomination: '指名', first_nomination: '初回指名', confirmed: '本指名', princess: '姫予約' }
    return map[v] || v
  }

  const generateLineText = () => {
    if (!hasSearched) return ''
    const therapist = therapists.find(t => t.id === selectedTherapistId)
    const therapistName = therapist ? therapist.name : '未選択'

    const dateObj = new Date(targetDate)
    const dateStr = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`

    let text = `お疲れ様です！本日の精算です。\n\n`
    text += `【日付】 ${dateStr}\n`
    text += `【セラピスト】 ${therapistName} さん\n`

    if (calculatedRows.length === 0) {
      text += `\n本日の予約はありませんでした。\n`
    } else {
      calculatedRows.forEach((row, index) => {
        const res = row.reservation
        const r = row.result
        text += `\n■ ${index + 1}予約目 (${res.start_time.slice(0, 5)}〜${res.end_time.slice(0, 5)})\n`
        text += `・${res.customer?.name || 'お客様'} 様\n`

        // コースバック
        if (r.courseBack > 0) {
          text += `・コース ${res.course?.duration || 0}分 ¥${r.courseBack.toLocaleString()}\n`
        }

        // 延長バック
        if ((res.extension_count || 0) > 0 && r.extensionBack > 0) {
          text += `・延長 ${(res.extension_count || 0) * extensionUnitMinutes}分 ¥${r.extensionBack.toLocaleString()}\n`
        }

        // 指名料バック
        if (r.nominationBack > 0) {
          text += `・${designationLabel(res.designation_type)} ¥${r.nominationBack.toLocaleString()}\n`
        }

        // オプションバック（1つずつ）
        if (res.reservation_options?.length > 0) {
          // カスタムオプションは固定バック額を使用
          const customOpts = res.reservation_options.filter(o => !o.option_id)
          const systemOpts = res.reservation_options.filter(o => !!o.option_id)
          const customBackTotal = customOpts.reduce((sum, o) => sum + (o.custom_back_amount || 0), 0)
          const systemBackTotal = r.optionBack - customBackTotal

          // システムオプション：按分
          const systemOptsPrice = systemOpts.reduce((sum, o) => sum + o.price, 0)
          systemOpts.forEach((o, i) => {
            const isLast = i === systemOpts.length - 1
            const optionBack = systemOptsPrice > 0
              ? isLast
                ? systemBackTotal - systemOpts.slice(0, i).reduce((sum, prev) => sum + Math.round(prev.price / systemOptsPrice * systemBackTotal), 0)
                : Math.round(o.price / systemOptsPrice * systemBackTotal)
              : 0
            if (optionBack > 0) {
              text += `・${o.option?.name || 'オプション'} ¥${optionBack.toLocaleString()}\n`
            }
          })

          // カスタムオプション：固定バック額を使用
          customOpts.forEach(o => {
            const optionBack = o.custom_back_amount || 0
            if (optionBack > 0) {
              text += `・${o.custom_name || 'オプション'} ¥${optionBack.toLocaleString()}\n`
            }
          })
        }

        // 姫予約ボーナス
        if (res.is_hime && r.himeBonus > 0) {
          text += `・姫予約ボーナス ¥${r.himeBonus.toLocaleString()}\n`
        }

        // 控除
        if (r.deductions > 0) {
          text += `・控除 -¥${r.deductions.toLocaleString()}\n`
        }

        // 手当
        if (r.allowances > 0) {
          text += `・手当 +¥${r.allowances.toLocaleString()}\n`
        }

        text += `給与合計: ¥${r.netBack.toLocaleString()}\n`
      })
    }

    text += `\n------------------------\n`
    text += `★ 本日合計バック: ¥${netPay.toLocaleString()}\n`
    text += `★ 本日店落ち: ¥${(totalSales - netPay).toLocaleString()}\n`
    if (hasCreditReservation) {
      const cashBalance = totalCashReceived - netPay
      text += `★ 現金残: ${cashBalance < 0 ? `-¥${Math.abs(cashBalance).toLocaleString()}` : `¥${cashBalance.toLocaleString()}`}\n`
    }
    text += `------------------------\n`
    text += `\nご確認よろしくお願いいたします！`
    return text
  }

  const handleCopy = () => {
    const text = generateLineText()
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(err => {
      console.error(err)
    })
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">報酬・バック計算</h1>
            <p className="text-sm text-slate-500 mt-1">セラピストごとの日次報酬明細を表示します。予約登録時に自動計算されたバック額を確認できます。</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* コントロールパネル */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-end">
          <div className="flex-1 w-full relative">
            <label className="block text-sm font-medium text-slate-700 mb-2">対象日</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all font-medium"
            />
          </div>
          <div className="flex-1 w-full relative">
            <label className="block text-sm font-medium text-slate-700 mb-2">セラピスト</label>
            <select
              value={selectedTherapistId}
              onChange={(e) => setSelectedTherapistId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all font-medium"
            >
              <option value="">選択してください</option>
              {therapists.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => handleCalculate(true)}
              disabled={loading || !selectedTherapistId || !targetDate}
              className="flex-1 md:flex-none px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '読込中...' : '精算を表示'}
            </button>
          </div>
        </div>

        {/* 結果エリア */}
        {hasSearched && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* 左: 明細リスト */}
            <div className="col-span-1 lg:col-span-2 space-y-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                本日の予約・バック明細 ({calculatedRows.length}件)
              </h2>

              {calculatedRows.length === 0 ? (
                <div className="bg-white border text-center border-slate-200 rounded-2xl p-10 text-slate-500">
                  指定された日に予約はありませんでした。
                </div>
              ) : (
                <div className="space-y-4">
                  {calculatedRows.map((row, idx) => {
                    const res = row.reservation
                    const r = row.result
                    return (
                      <div key={res.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-100">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold border border-indigo-100">
                                予約 {idx + 1}
                              </span>
                              {row.fromCache && (
                                <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-xs font-medium border border-emerald-100">
                                  計算済み
                                </span>
                              )}
                              <span className="font-bold text-slate-800 text-lg">
                                {res.start_time.slice(0, 5)}〜{res.end_time.slice(0, 5)}
                              </span>
                            </div>
                            <div className="text-sm font-medium text-slate-600">
                              {res.customer?.name || 'フリー客'} 様 / {res.course?.name} ({res.course?.duration}分)
                              {res.extension_count > 0 && (
                                <span className="ml-2 text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded text-xs border border-orange-100">
                                  延長 +{res.extension_count * extensionUnitMinutes}分
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="inline-block bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-bold mb-1">
                              {designationLabel(res.designation_type)}
                            </span>
                            <div className="text-sm font-bold text-slate-800 mb-1">
                              売上: ¥{r.totalPrice.toLocaleString()}
                            </div>
                            {r.totalDiscount > 0 && (
                              <div className="text-xs text-rose-500 font-medium bg-rose-50 px-2 py-0.5 rounded inline-block">
                                割引適用: -¥{r.totalDiscount.toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-sm text-slate-500">
                            {r.calcMethod}
                          </div>
                          <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 text-indigo-900">
                            <div className="text-xs text-indigo-500 font-medium">バック合計</div>
                            <div className="font-bold text-lg leading-tight">¥{r.netBack.toLocaleString()}</div>
                          </div>
                        </div>

                        {res.payment_method === 'credit' && (() => {
                          const optionsCash = res.options_payment_method === 'cash' ? (res.options_price || 0) : 0
                          const cashBalance = optionsCash - r.netBack
                          return (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">現金精算（クレジット着金前）</div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                <div className="text-slate-600">
                                  お客様現金: <span className="font-bold text-slate-800">¥{optionsCash.toLocaleString()}</span>
                                </div>
                                <div className="text-slate-400">－</div>
                                <div className="text-slate-600">
                                  バック支払: <span className="font-bold text-slate-800">¥{r.netBack.toLocaleString()}</span>
                                </div>
                                <div className="text-slate-400">=</div>
                                <div>
                                  <span className="text-slate-600">現金残: </span>
                                  <span className={`font-extrabold text-base ${cashBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {cashBalance < 0 ? `▼ -¥${Math.abs(cashBalance).toLocaleString()}` : `¥${cashBalance.toLocaleString()}`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 右: LINE用エクスポートとサマリー */}
            <div className="col-span-1 space-y-6">
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-md">
                <h3 className="text-indigo-100 text-sm font-bold uppercase tracking-wider mb-2">本日報酬合計</h3>
                <div className="text-4xl font-extrabold mb-4 font-mono tracking-tighter">
                  ¥{netPay.toLocaleString()}
                </div>
                {shiftAllowance > 0 && (
                  <div className="text-sm text-indigo-200 mb-2">
                    交通費手当含む: +¥{shiftAllowance.toLocaleString()}
                  </div>
                )}
                {totalHimeBonus > 0 && (
                  <div className="text-sm text-pink-200 mb-2">
                    ♥ 姫予約ボーナス含む: +¥{totalHimeBonus.toLocaleString()}
                  </div>
                )}
                <div className="flex justify-between items-center text-sm text-indigo-100 pt-4 border-t border-white/20">
                  <span>総売上</span>
                  <span className="font-bold">¥{totalSales.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-indigo-100 pt-2 mb-2">
                  <span>店落ち</span>
                  <span className="font-bold border-b border-white/30 truncate">¥{(totalSales - netPay).toLocaleString()}</span>
                </div>
                {totalExtensionMinutes > 0 && (
                  <div className="flex justify-between items-center text-sm text-indigo-100 pt-3 border-t border-white/20">
                    <span>延長合計時間</span>
                    <span className="font-bold text-orange-200 text-lg">{totalExtensionMinutes} <span className="text-xs font-normal">分</span></span>
                  </div>
                )}
                {hasCreditReservation && (
                  <div className="mt-3 pt-3 border-t border-white/20">
                    <div className="text-xs text-indigo-200 mb-1 font-bold uppercase tracking-wider">現金残（クレジット着金前）</div>
                    <div className={`text-xl font-extrabold ${(totalCashReceived - netPay) < 0 ? 'text-red-300' : 'text-white'}`}>
                      {(totalCashReceived - netPay) < 0
                        ? `▼ -¥${Math.abs(totalCashReceived - netPay).toLocaleString()}`
                        : `¥${(totalCashReceived - netPay).toLocaleString()}`}
                    </div>
                    {(totalCashReceived - netPay) < 0 && (
                      <div className="text-[10px] text-red-200 mt-0.5">クレジット着金後に不足分を補填</div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[500px]">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#06C755]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.5 10c0-4.81-4.71-8.7-10.5-8.7S1.5 5.19 1.5 10c0 4.3 3.55 7.95 8.44 8.6.35.08.83.24.96.55.12.3-.04.75-.12 1.15-.05.22-.32 1.52-.39 1.83-.07.31-.38.9.79.41 1.17-.5 6.32-3.71 8.7-6.43 1.76-2 2.62-4.14 2.62-6.11z" />
                    </svg>
                    LINE送信用テキスト
                  </h3>
                  <button
                    onClick={handleCopy}
                    className={`text-xs font-bold border px-3 py-1.5 rounded-lg transition-all shadow-sm active:scale-95 flex items-center gap-1.5 ${copied ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-indigo-600 hover:text-indigo-800 border-indigo-200'}`}
                  >
                    {copied ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        コピーしました
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        テキストをコピー
                      </>
                    )}
                  </button>
                </div>
                <div className="p-4 flex-1 bg-slate-50/50">
                  <textarea
                    readOnly
                    className="w-full h-full bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700 font-mono focus:outline-none resize-none leading-relaxed"
                    value={generateLineText()}
                  />
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
