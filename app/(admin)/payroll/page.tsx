'use client'
/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import { calculateBack, BackCalculationInput, BackCalculationResult } from '@/lib/calculateBack'
import { toDisplayTime } from '@/lib/timeUtils'

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
  business_date?: string | null
  start_time: string
  end_time: string
  extension_count: number
  payment_method: 'cash' | 'credit' | null
  options_payment_method: 'cash' | 'credit' | null
  extension_payment_method: 'cash' | 'credit' | null
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
  reservation_discounts: { applied_amount: number; burden_type: 'shop_only' | 'split' | 'therapist_only'; therapist_burden_amount: number | null; discount_policy: { name: string } | null }[]
}

type CalculatedRow = {
  reservation: ReservationWithDetails
  result: BackCalculationResult
  fromCache: boolean // 予約登録時に計算済みかどうか
}

type DeductionRule = {
  id: string
  name: string
  category: 'deduction' | 'allowance' | 'penalty'
  calc_timing: 'per_reservation' | 'per_shift' | 'monthly' | 'manual'
  amount: number
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
  const [designationMap, setDesignationMap] = useState<Record<string, string>>({})

  // フォーム状態
  const [targetDate, setTargetDate] = useState<string>(getBusinessDate())
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('')
  const [extensionUnitMinutes, setExtensionUnitMinutes] = useState<number>(30)

  // 結果状態
  const [loading, setLoading] = useState(false)
  const [calculatedRows, setCalculatedRows] = useState<CalculatedRow[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isLineExportOpen, setIsLineExportOpen] = useState(false)
  const [deductionRules, setDeductionRules] = useState<DeductionRule[]>([])
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set())

  // 引き継ぎメモ用の状態
  interface TherapistMemo {
    id: string;
    date: string;
    content: string;
    amount: number;
    is_resolved: boolean;
    resolved_at?: string | null;
    resolved_date?: string | null;
  }
  const [unresolvedMemos, setUnresolvedMemos] = useState<TherapistMemo[]>([])
  const [selectedMemoIds, setSelectedMemoIds] = useState<Set<string>>(new Set())
  const [memoResolving, setMemoResolving] = useState(false)

  useEffect(() => {
    async function fetchDeductionRules() {
      if (!selectedShop) { setDeductionRules([]); return }
      const { data } = await supabase
        .from('deduction_rules')
        .select('id, name, category, calc_timing, amount')
        .eq('shop_id', selectedShop.id)
        .eq('is_active', true)
        .order('category')
      setDeductionRules((data as DeductionRule[]) || [])
    }
    void fetchDeductionRules()
  }, [selectedShop])

  useEffect(() => {
    async function fetchDesignationTypes() {
      if (!selectedShop) return
      const { data } = await supabase
        .from('designation_types')
        .select('slug, display_name')
        .eq('shop_id', selectedShop.id)
        .eq('is_active', true)
      if (data) {
        const map: Record<string, string> = {}
        data.forEach((d) => {
          if (d.slug) map[d.slug] = d.display_name
        })
        setDesignationMap(map)
      } else {
        setDesignationMap({})
      }
    }
    void fetchDesignationTypes()
  }, [selectedShop])

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
    setSelectedRuleIds(new Set())

    try {
      const therapist = therapists.find(t => t.id === selectedTherapistId)
      if (!therapist) throw new Error('セラピストが見つかりません')

      const { data: resData, error: resError } = await supabase
        .from('reservations')
        .select(`
          id, course_id, base_price, options_price, nomination_fee, discount_amount, designation_type, date, business_date, start_time, end_time, extension_count, status, payment_method, options_payment_method, extension_payment_method, credit_fee_amount, therapist_back_amount, total_price, shop_revenue, back_calculated_at, is_hime, hime_bonus,
          course:courses(name, duration, base_price, back_amount),
          customer:customers(name),
          reservation_options(option_id, price, custom_name, custom_back_amount, option:options(name)),
          reservation_discounts(applied_amount, burden_type, therapist_burden_amount, discount_policy:discount_policies(name))
        `)
        .eq('shop_id', selectedShop.id)
        .eq('therapist_id', selectedTherapistId)
        .or(`business_date.eq.${targetDate},and(business_date.is.null,date.eq.${targetDate})`)
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
          const therapistBurden = (res.reservation_discounts || []).reduce((sum, d) => {
            if (d.therapist_burden_amount != null) return sum + Math.min(d.therapist_burden_amount, d.applied_amount)
            if (d.burden_type === 'therapist_only') return sum + d.applied_amount
            if (d.burden_type === 'split') return sum + Math.floor(d.applied_amount / 2)
            return sum
          }, 0)

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
              therapistDiscountBurden: therapistBurden,
              businessDate: res.business_date || res.date,
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

      // 未解決メモを取得
      const { data: memoData, error: memoError } = await supabase
        .from('therapist_memos')
        .select('id, date, content, amount, is_resolved, resolved_at, resolved_date')
        .eq('shop_id', selectedShop.id)
        .eq('therapist_id', selectedTherapistId)
        .eq('is_resolved', false)
        .order('date', { ascending: true })

      if (!memoError && memoData) {
        setUnresolvedMemos(memoData as TherapistMemo[])
        setSelectedMemoIds(new Set(memoData.map(m => m.id)))
      } else {
        setUnresolvedMemos([])
        setSelectedMemoIds(new Set())
      }

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
    let hime = 0
    let baseNetTotal = 0
    let cashReceived = 0
    let hasCredit = false

    calculatedRows.forEach(({ reservation: res, result }) => {
      sales += result.totalPrice
      back += result.totalBack
      const resHime = res.is_hime ? (res.hime_bonus || 0) : 0
      hime += resHime
      baseNetTotal += result.totalBack + resHime

      if (res.payment_method === 'credit') {
        hasCredit = true
        if (res.options_payment_method === 'cash') {
          cashReceived += res.options_price || 0
        }
        if (res.extension_payment_method === 'cash' && res.extension_count > 0) {
          const extensionPrice = Math.max(0, (res.total_price || 0) - (res.base_price || 0) - (res.options_price || 0) - (res.nomination_fee || 0) + (res.discount_amount || 0))
          cashReceived += extensionPrice
        }
      } else {
        cashReceived += result.totalPrice
      }
    })

    // 手動選択された控除・手当を計算
    const reservationCount = calculatedRows.length
    let manualDed = 0
    let manualAll = 0
    for (const rule of deductionRules) {
      if (!selectedRuleIds.has(rule.id)) continue
      const multiplier = rule.calc_timing === 'per_reservation' ? reservationCount : 1
      if (rule.category === 'deduction' || rule.category === 'penalty') {
        manualDed += rule.amount * multiplier
      } else if (rule.category === 'allowance') {
        manualAll += rule.amount * multiplier
      }
    }

    // 選択された引き継ぎメモ調整を合算（amount 正＝手当(加算)、負＝控除(減算)）
    let memoAdjust = 0
    unresolvedMemos.forEach(m => {
      if (selectedMemoIds.has(m.id)) {
        memoAdjust += m.amount
      }
    })

    return {
      totalSales: sales,
      totalBack: back,
      totalDeductions: manualDed + (memoAdjust < 0 ? Math.abs(memoAdjust) : 0),
      totalAllowances: manualAll + (memoAdjust > 0 ? memoAdjust : 0),
      totalHimeBonus: hime,
      netPay: Math.max(0, baseNetTotal - manualDed + manualAll + memoAdjust),
      totalCashReceived: cashReceived,
      hasCreditReservation: hasCredit,
    }
  }, [calculatedRows, deductionRules, selectedRuleIds, unresolvedMemos, selectedMemoIds])

  const totalExtensionMinutes = useMemo(() => {
    const count = calculatedRows.reduce((sum, row) => sum + (row.reservation.extension_count || 0), 0)
    return count * extensionUnitMinutes
  }, [calculatedRows, extensionUnitMinutes])

  // reservation_discounts からセラピスト負担額合計を計算（キャッシュ行でも正確に出るよう生データから算出）
  const calcTherapistBurden = (discounts: ReservationWithDetails['reservation_discounts']): number =>
    (discounts || []).reduce((sum, d) => {
      if (d.therapist_burden_amount != null) return sum + Math.min(d.therapist_burden_amount, d.applied_amount)
      if (d.burden_type === 'therapist_only') return sum + d.applied_amount
      if (d.burden_type === 'split') return sum + Math.floor(d.applied_amount / 2)
      return sum
    }, 0)

  const designationLabel = (v: string) => {
    if (designationMap && designationMap[v]) return designationMap[v]
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
        text += `\n■ ${index + 1}予約目 (${toDisplayTime(res.start_time)}〜${toDisplayTime(res.end_time)})\n`
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

        // 割引負担（セラピスト負担分）
        const discountBurden = calcTherapistBurden(res.reservation_discounts)
        if (discountBurden > 0) {
          // 割引ごとに名前付きで表示
          const burdenLines = (res.reservation_discounts || []).filter(d => {
            if (d.therapist_burden_amount != null) return d.therapist_burden_amount > 0
            return d.burden_type === 'therapist_only' || d.burden_type === 'split'
          })
          if (burdenLines.length === 1) {
            const d = burdenLines[0]
            const name = d.discount_policy?.name || '割引'
            const amount = d.therapist_burden_amount != null
              ? Math.min(d.therapist_burden_amount, d.applied_amount)
              : d.burden_type === 'split' ? Math.floor(d.applied_amount / 2) : d.applied_amount
            text += `・${name} 負担: -¥${amount.toLocaleString()}\n`
          } else {
            text += `・割引負担合計: -¥${discountBurden.toLocaleString()}\n`
          }
        }

        // 姫予約ボーナス
        if (res.is_hime && r.himeBonus > 0) {
          text += `・姫予約ボーナス ¥${r.himeBonus.toLocaleString()}\n`
        }

        const rowNet = r.totalBack + (res.is_hime ? (res.hime_bonus || 0) : 0)
        text += `給与合計: ¥${rowNet.toLocaleString()}\n`
      })
    }

    // 選択された控除・手当
    const selectedRules = deductionRules.filter(r => selectedRuleIds.has(r.id))
    if (selectedRules.length > 0) {
      text += `\n【控除・手当】\n`
      for (const rule of selectedRules) {
        const multiplier = rule.calc_timing === 'per_reservation' ? calculatedRows.length : 1
        const total = rule.amount * multiplier
        const isDeduction = rule.category === 'deduction' || rule.category === 'penalty'
        const sign = isDeduction ? '-' : '+'
        const detail = rule.calc_timing === 'per_reservation' && multiplier > 1 ? `（${multiplier}件 × ¥${rule.amount.toLocaleString()}）` : ''
        text += `・${rule.name}: ${sign}¥${total.toLocaleString()}${detail}\n`
      }
    }

    // 選択された引き継ぎメモ調整
    const selectedMemos = unresolvedMemos.filter(m => selectedMemoIds.has(m.id))
    if (selectedMemos.length > 0) {
      text += `\n【引継ぎメモ調整】\n`
      for (const memo of selectedMemos) {
        const sign = memo.amount >= 0 ? '+' : ''
        text += `・${memo.content} (${memo.date}): ${sign}¥${memo.amount.toLocaleString()}\n`
      }
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

  const handleResolveSelectedMemos = async () => {
    const ids = Array.from(selectedMemoIds)
    if (ids.length === 0) return
    if (!confirm('選択された引き継ぎメモを「精算済み」に変更しますか？')) return

    setMemoResolving(true)
    const { error } = await supabase
      .from('therapist_memos')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_date: targetDate
      })
      .in('id', ids)

    setMemoResolving(false)
    if (error) {
      alert('引き継ぎメモの更新に失敗しました: ' + error.message)
    } else {
      alert('選択された引き継ぎメモを精算済みに更新しました。')
      void handleCalculate(true)
    }
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
    <div className="bg-gray-100 p-2 md:p-4">
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
        <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm grid grid-cols-2 md:flex md:flex-row gap-4 md:gap-6 items-end">
          <div className="col-span-1 md:flex-1 w-full relative">
            <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1.5 md:mb-2">対象日</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2.5 md:px-4 md:py-3 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all font-medium text-sm md:text-base"
            />
          </div>
          <div className="col-span-1 md:flex-1 w-full relative">
            <label className="block text-xs md:text-sm font-medium text-slate-700 mb-1.5 md:mb-2">セラピスト</label>
            <select
              value={selectedTherapistId}
              onChange={(e) => setSelectedTherapistId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 px-3 py-2.5 md:px-4 md:py-3 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all font-medium text-sm md:text-base"
            >
              <option value="">選択してください</option>
              {therapists.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 md:flex-none flex gap-2 w-full md:w-auto">
            <button
              onClick={() => handleCalculate(true)}
              disabled={loading || !selectedTherapistId || !targetDate}
              className="w-full md:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base whitespace-nowrap"
            >
              {loading ? '読込中...' : '精算を表示'}
            </button>
          </div>
        </div>

        {/* 結果エリア */}
        {hasSearched && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* 左: 明細リスト (スマホ時は下部に表示) */}
            <div className="col-span-1 lg:col-span-2 space-y-4 order-last lg:order-first">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 px-1 md:px-0">
                <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                本日の予約・バック明細 ({calculatedRows.length}件)
              </h2>

              {calculatedRows.length === 0 ? (
                <div className="bg-white border text-center border-slate-200 rounded-2xl p-10 text-slate-500 shadow-sm">
                  指定された日に予約はありませんでした。
                </div>
              ) : (
                <div className="space-y-4">
                  {calculatedRows.map((row, idx) => {
                    const res = row.reservation
                    const r = row.result
                    return (
                      <div key={res.id} className="bg-white border border-slate-200 rounded-2xl p-3.5 md:p-5 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4 mb-3.5 pb-3.5 border-b border-slate-100">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] md:text-xs font-bold border border-indigo-100">
                                予約 {idx + 1}
                              </span>
                              {row.fromCache && (
                                <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded text-[10px] md:text-xs font-medium border border-emerald-100">
                                  計算済み
                                </span>
                              )}
                              <span className="font-bold text-slate-800 text-base md:text-lg">
                                {toDisplayTime(res.start_time)}〜{toDisplayTime(res.end_time)}
                              </span>
                            </div>
                            <div className="text-xs md:text-sm font-medium text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span>{res.customer?.name || 'フリー客'} 様</span>
                              <span className="text-slate-300">/</span>
                              <span className="truncate max-w-[150px] sm:max-w-none">{res.course?.name} ({res.course?.duration}分)</span>
                              {res.extension_count > 0 && (
                                <span className="text-orange-600 font-bold bg-orange-50 px-1 py-0.5 rounded text-[10px] border border-orange-100 whitespace-nowrap">
                                  延長 +{res.extension_count * extensionUnitMinutes}分
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-left sm:text-right flex flex-row sm:flex-col flex-wrap sm:items-end items-center gap-2 sm:gap-1">
                            <span className="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-bold">
                              {designationLabel(res.designation_type)}
                            </span>
                            <div className="text-xs md:text-sm font-bold text-slate-800">
                              売上: ¥{r.totalPrice.toLocaleString()}
                            </div>
                            {r.totalDiscount > 0 && (
                              <div className="text-[10px] text-rose-500 font-medium bg-rose-50 px-1.5 py-0.5 rounded inline-block">
                                割引適用: -¥{r.totalDiscount.toLocaleString()}
                              </div>
                            )}
                            {calcTherapistBurden(res.reservation_discounts) > 0 && (
                              <div className="text-[10px] text-orange-600 font-medium bg-orange-50 px-1.5 py-0.5 rounded inline-block">
                                割引負担: -¥{calcTherapistBurden(res.reservation_discounts).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-[10px] md:text-xs text-slate-400">
                            {r.calcMethod}
                          </div>
                          <div className="bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 text-indigo-900 text-right">
                            <div className="text-[10px] text-indigo-500 font-medium leading-none mb-0.5">バック合計</div>
                            <div className="font-bold text-base md:text-lg leading-tight">¥{r.netBack.toLocaleString()}</div>
                          </div>
                        </div>

                        {res.payment_method === 'credit' && (() => {
                          const optionsCash = res.options_payment_method === 'cash' ? (res.options_price || 0) : 0
                          const extPrice = res.extension_count > 0
                            ? Math.max(0, (res.total_price || 0) - (res.base_price || 0) - (res.options_price || 0) - (res.nomination_fee || 0) + (res.discount_amount || 0))
                            : 0
                          const extensionCash = res.extension_payment_method === 'cash' ? extPrice : 0
                          const customerCash = optionsCash + extensionCash
                          const cashBalance = customerCash - r.netBack
                          return (
                            <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                              <div className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">現金精算（クレジット着金前）</div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                                <div>
                                  お客様現金: <span className="font-bold text-slate-800">¥{customerCash.toLocaleString()}</span>
                                  {(optionsCash > 0 || extensionCash > 0) && (
                                    <span className="text-[10px] text-slate-400 ml-1">
                                      ({optionsCash > 0 && `オプション:¥${optionsCash.toLocaleString()}`}
                                      {optionsCash > 0 && extensionCash > 0 && ' + '}
                                      {extensionCash > 0 && `延長:¥${extensionCash.toLocaleString()}`})
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-300">|</div>
                                <div>
                                  バック支払: <span className="font-bold text-slate-800">¥{r.netBack.toLocaleString()}</span>
                                </div>
                                <div className="text-slate-300">|</div>
                                <div className="flex items-center gap-1">
                                  <span>現金残:</span>
                                  <span className={`font-extrabold ${cashBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
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

            {/* 右: LINE用エクスポートとサマリー (スマホ時は上部に表示) */}
            <div className="col-span-1 space-y-4 md:space-y-6 order-first lg:order-last">
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 md:p-6 text-white shadow-md">
                <h3 className="text-indigo-100 text-xs md:text-sm font-bold uppercase tracking-wider mb-1">本日報酬合計</h3>
                <div className="text-3xl md:text-4xl font-extrabold mb-3 font-mono tracking-tighter">
                  ¥{netPay.toLocaleString()}
                </div>
                {totalHimeBonus > 0 && (
                  <div className="text-xs md:text-sm text-pink-200 mb-3 bg-white/10 px-2.5 py-1 rounded-lg inline-block">
                    ♥ 姫予約ボーナス含む: +¥{totalHimeBonus.toLocaleString()}
                  </div>
                )}
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-x-4 gap-y-3 pt-4 border-t border-white/20">
                  <div className="flex justify-between items-center text-xs md:text-sm text-indigo-100">
                    <span>総売上</span>
                    <span className="font-bold">¥{totalSales.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs md:text-sm text-indigo-100">
                    <span>店落ち</span>
                    <span className="font-bold truncate">¥{(totalSales - netPay).toLocaleString()}</span>
                  </div>
                  {totalExtensionMinutes > 0 && (
                    <div className="flex justify-between items-center text-xs md:text-sm text-indigo-100 lg:pt-2 lg:border-t lg:border-white/10">
                      <span>延長時間</span>
                      <span className="font-bold text-orange-200">{totalExtensionMinutes}分</span>
                    </div>
                  )}
                  {hasCreditReservation && (
                    <div className="col-span-2 lg:col-span-1 lg:pt-2 lg:border-t lg:border-white/10">
                      <div className="flex justify-between items-center text-xs md:text-sm text-indigo-100">
                        <span>現金残</span>
                        <span className={`font-bold ${(totalCashReceived - netPay) < 0 ? 'text-red-300' : 'text-white'}`}>
                          {(totalCashReceived - netPay) < 0
                            ? `-¥${Math.abs(totalCashReceived - netPay).toLocaleString()}`
                            : `¥${(totalCashReceived - netPay).toLocaleString()}`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 控除・手当を選択 */}
              {deductionRules.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-5">
                  <h3 className="font-bold text-slate-700 mb-3 text-sm">控除・手当を選択</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                    {deductionRules.map(rule => {
                      const multiplier = rule.calc_timing === 'per_reservation' ? calculatedRows.length : 1
                      const total = rule.amount * multiplier
                      const isDeduction = rule.category === 'deduction' || rule.category === 'penalty'
                      return (
                        <label key={rule.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-slate-50 border border-slate-100 lg:border-0">
                          <input
                            type="checkbox"
                            className="rounded w-4 h-4 accent-indigo-600 flex-shrink-0"
                            checked={selectedRuleIds.has(rule.id)}
                            onChange={(e) => {
                              const next = new Set(selectedRuleIds)
                              if (e.target.checked) next.add(rule.id)
                              else next.delete(rule.id)
                              setSelectedRuleIds(next)
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-700 truncate">{rule.name}</div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {rule.calc_timing === 'per_reservation'
                                ? `${calculatedRows.length}件×¥${rule.amount.toLocaleString()}`
                                : rule.calc_timing === 'per_shift' ? '出勤ごと'
                                : rule.calc_timing === 'monthly' ? '月次'
                                : '手動'}
                            </div>
                          </div>
                          <div className={`text-xs font-bold flex-shrink-0 ${isDeduction ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {isDeduction ? '-' : '+'}¥{total.toLocaleString()}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 引き継ぎメモ調整 */}
              {unresolvedMemos.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-700 text-sm">引継ぎメモ調整</h3>
                    <button
                      onClick={handleResolveSelectedMemos}
                      disabled={memoResolving || selectedMemoIds.size === 0}
                      className="px-2.5 py-1.5 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 active:scale-95 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm"
                    >
                      {memoResolving ? '処理中...' : '精算済みにする'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                    {unresolvedMemos.map(memo => {
                      const isDeduction = memo.amount < 0
                      return (
                        <label key={memo.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-slate-50 border border-slate-100 lg:border-0">
                          <input
                            type="checkbox"
                            className="rounded w-4 h-4 accent-indigo-600 flex-shrink-0"
                            checked={selectedMemoIds.has(memo.id)}
                            onChange={(e) => {
                              const next = new Set(selectedMemoIds)
                              if (e.target.checked) next.add(memo.id)
                              else next.delete(memo.id)
                              setSelectedMemoIds(next)
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-700 truncate">{memo.content}</div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {memo.date}
                            </div>
                          </div>
                          <div className={`text-xs font-bold flex-shrink-0 ${isDeduction ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {memo.amount >= 0 ? '+' : ''}¥{memo.amount.toLocaleString()}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all duration-300 ${
                isLineExportOpen ? 'h-[320px] lg:h-[500px]' : 'h-[64px] lg:h-[500px]'
              }`}>
                <div 
                  onClick={() => setIsLineExportOpen(!isLineExportOpen)}
                  className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center cursor-pointer lg:cursor-default select-none"
                >
                  <h3 className="font-bold text-slate-700 flex items-center gap-2 text-xs md:text-sm">
                    <svg className="w-4 h-4 text-[#06C755] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.5 10c0-4.81-4.71-8.7-10.5-8.7S1.5 5.19 1.5 10c0 4.3 3.55 7.95 8.44 8.6.35.08.83.24.96.55.12.3-.04.75-.12 1.15-.05.22-.32 1.52-.39 1.83-.07.31-.38.9.79.41 1.17-.5 6.32-3.71 8.7-6.43 1.76-2 2.62-4.14 2.62-6.11z" />
                    </svg>
                    <span>LINE送信用テキスト</span>
                    <span className="lg:hidden text-[10px] text-slate-400 font-normal">
                      ({isLineExportOpen ? 'タップで閉じる' : 'タップで表示'})
                    </span>
                  </h3>
                  
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={handleCopy}
                      className={`text-xs font-bold border px-2.5 py-1.5 rounded-lg transition-all shadow-sm active:scale-95 flex items-center gap-1 ${copied ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-indigo-600 hover:text-indigo-800 border-indigo-200'}`}
                    >
                      {copied ? (
                        <>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          <span>コピー完了</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>コピー</span>
                        </>
                      )}
                    </button>
                    <button 
                      onClick={() => setIsLineExportOpen(!isLineExportOpen)}
                      className="lg:hidden p-1 text-slate-400 hover:text-slate-600 transition-transform duration-200"
                      style={{ transform: isLineExportOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className={`p-4 flex-1 bg-slate-50/50 transition-all duration-300 ${
                  isLineExportOpen ? 'opacity-100 visible' : 'opacity-0 invisible lg:opacity-100 lg:visible'
                }`}>
                  <textarea
                    readOnly
                    className="w-full h-full min-h-[180px] lg:min-h-0 bg-white border border-slate-200 rounded-xl p-3 text-xs md:text-sm text-slate-700 font-mono focus:outline-none resize-none leading-relaxed"
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
