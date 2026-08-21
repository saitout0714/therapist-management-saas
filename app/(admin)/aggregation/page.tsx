'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useShop } from '@/app/contexts/ShopContext'
import { useAuth } from '@/app/contexts/AuthContext'
import Link from 'next/link'
import { toDisplayTime } from '@/lib/timeUtils'
import { calcStandbyHours, resolveStandbyAmount, StandbyGuaranteeTier } from '@/lib/standbyGuarantee'

interface DailySummary {
  date: string;
  totalSales: number;
  cashSales: number;
  creditCount: number;
  creditSales: number;
  paypayCount: number;
  paypaySales: number;
  totalBack: number;
  shopProfit: number;
  reservationCount: number;
  totalCreditFee: number;
  totalPaypayFee: number;
  /** 控除・手当・ペナルティ・待機保証の合計（利益への影響。控除＝プラス、手当・保証＝マイナス） */
  adjustmentTotal: number;
  /** 調整の件数 */
  adjustmentCount: number;
}

/** 待機保証の対象者を割り出すために使う出勤枠 */
interface ShiftRow {
  therapist_id: string
  date: string
  start_time: string | null
  end_time: string | null
}

type AdjustmentCategory = 'deduction' | 'penalty' | 'allowance' | 'standby_guarantee' | null

/**
 * 控除・ペナルティ・手当・待機保証の実績（1件＝therapist_memos の1行）。
 *
 * 毎日決まって発生するルールがある店舗はほぼ無く、当欠・釣銭不足・不足分の補填のような
 * イレギュラーな単発調整が大半なため、日付×セラピストの単発記録として自由に足せるようにしている。
 * amount は符号付き：マイナス＝セラピストへの支払いから差し引く（控除・ペナルティ）、
 * プラス＝セラピストへ追加で払う（手当・待機保証）。
 */
interface AdjustmentRow {
  id: string
  therapist_id: string
  date: string
  content: string
  amount: number
  category: AdjustmentCategory
  is_resolved: boolean
}

/** 待機保証を日付×セラピストで引くためのキー（自動提案ウィジェット用） */
const standbyKey = (date: string, therapistId: string) => `${date}_${therapistId}`

const ADJUSTMENT_CATEGORY_LABELS: Record<Exclude<AdjustmentCategory, null>, string> = {
  deduction: '控除',
  penalty: 'ペナルティ',
  allowance: '手当',
  standby_guarantee: '待機保証',
}

const ADJUSTMENT_CATEGORY_COLORS: Record<Exclude<AdjustmentCategory, null>, string> = {
  deduction: 'bg-rose-50 text-rose-700',
  penalty: 'bg-amber-50 text-amber-700',
  allowance: 'bg-emerald-50 text-emerald-700',
  standby_guarantee: 'bg-indigo-50 text-indigo-700',
}

/**
 * standby_guarantee_tiers / therapist_memos.category がまだ本番DBに無い場合の判定。
 * 過去に「本番DBだけ列・テーブルが未作成」で画面が丸ごと落ちた経緯があるため、
 * 未マイグレーションのときは集計自体は通し、この機能だけ無効化して警告を出す。
 */
const isMissingRelation = (err: { code?: string; message?: string } | null) =>
  !!err && (err.code === '42P01' || err.code === 'PGRST205' || err.code === '42703' || /does not exist|schema cache/i.test(err.message || ''))

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
  paypay_fee_amount: number
  total_price: number | null
  therapist_back_amount: number | null
  shop_revenue: number | null
  course: { name: string; duration: number; base_price: number; back_amount: number } | null
  reservation_options: { option_id: string | null; price: number; custom_name?: string | null; option?: { name: string } | null }[]
  reservation_discounts: { applied_amount: number; burden_type: 'shop_only' | 'split' | 'therapist_only' }[]
  payment_method: 'cash' | 'credit' | 'paypay' | null
  options_payment_method: 'cash' | 'credit' | 'paypay' | null
  extension_payment_method: 'cash' | 'credit' | 'paypay' | null
  options_price?: number | null
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
  const { user } = useAuth()
  const [closingDate, setClosingDate] = useState<number>(20)
  const [savingClosingDate, setSavingClosingDate] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([])
  const [calculatedReservations, setCalculatedReservations] = useState<CalculatedReservation[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [periodStr, setPeriodStr] = useState('')

  // 控除・手当・ペナルティ・待機保証まわり
  const [shiftsByDate, setShiftsByDate] = useState<Record<string, ShiftRow[]>>({})
  /** 日付ごとの調整実績（therapist_memos）。日報モーダルの一覧・利益計算の両方に使う */
  const [adjustmentsByDate, setAdjustmentsByDate] = useState<Record<string, AdjustmentRow[]>>({})
  const [therapistNames, setTherapistNames] = useState<Record<string, string>>({})
  /** 手動追加フォームのセラピスト選択肢（自店舗＋出勤枠に出てきたヘルプ出勤者） */
  const [therapistOptions, setTherapistOptions] = useState<{ id: string; name: string }[]>([])
  const [defaultStandbyAmount, setDefaultStandbyAmount] = useState<number>(0)
  /** 待機時間による段階（未登録なら定額の defaultStandbyAmount が使われる） */
  const [standbyTiers, setStandbyTiers] = useState<StandbyGuaranteeTier[]>([])
  /** 待機保証ウィジェットで入力中の金額（保存前）。キーは standbyKey */
  const [standbyDrafts, setStandbyDrafts] = useState<Record<string, string>>({})
  const [savingStandbyKey, setSavingStandbyKey] = useState<string | null>(null)
  /** true = therapist_memos.category 列がまだ無い（マイグレーション未実行） */
  const [adjustmentsUnavailable, setAdjustmentsUnavailable] = useState(false)

  // 日報モーダル内の「手動で追加」フォーム
  const [newAdjustment, setNewAdjustment] = useState<{
    therapistId: string
    category: Exclude<AdjustmentCategory, null> | 'other'
    sign: 1 | -1
    content: string
    amount: string
  } | null>(null)
  const [editingAdjustmentId, setEditingAdjustmentId] = useState<string | null>(null)
  const [editAdjustmentForm, setEditAdjustmentForm] = useState<{ content: string; amount: string }>({ content: '', amount: '' })
  const [savingAdjustment, setSavingAdjustment] = useState(false)

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

      const [
        { data: resData, error: resError },
        { data: therapists, error: therapistError },
        { data: shiftData, error: shiftError },
        { data: memoData, error: memoError },
        { data: settingsData },
        { data: tierData },
      ] = await Promise.all([
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
          .eq('shop_id', selectedShop.id),
        // 予約0本の出勤者を割り出すために、期間中の出勤枠も取る
        supabase
          .from('shifts')
          .select('therapist_id, date, start_time, end_time')
          .eq('shop_id', selectedShop.id)
          .gte('date', startStr)
          .lte('date', endStr),
        // 控除・手当・ペナルティ・待機保証の実績（引き継ぎメモに区分列を足したもの）
        supabase
          .from('therapist_memos')
          .select('id, therapist_id, date, content, amount, category, is_resolved')
          .eq('shop_id', selectedShop.id)
          .gte('date', startStr)
          .lte('date', endStr),
        supabase
          .from('system_settings')
          .select('standby_guarantee_amount')
          .eq('shop_id', selectedShop.id)
          .limit(1),
        supabase
          .from('standby_guarantee_tiers')
          .select('id, min_hours, amount')
          .eq('shop_id', selectedShop.id),
      ])

      if (resError) throw resError
      if (therapistError) throw therapistError
      // 出勤の取得失敗は握り潰さない（黙って0件になると対象者が出てこない）
      if (shiftError) throw shiftError
      // 調整（控除・手当・ペナルティ・待機保証）は category 列が未作成のときだけ「機能オフ」に倒し、
      // それ以外のエラーは表に出す
      const adjustmentsMissing = isMissingRelation(memoError)
      setAdjustmentsUnavailable(adjustmentsMissing)
      if (memoError && !adjustmentsMissing) throw memoError

      const reservations = (resData as unknown) as (ReservationWithDetails & { reception_source?: string })[]
      
      const dailyMap: Record<string, ReservationWithDetails[]> = {}
      reservations.forEach(res => {
        const targetDate = res.business_date || res.date
        if (!dailyMap[targetDate]) dailyMap[targetDate] = []
        dailyMap[targetDate].push(res)
      })

      // 出勤枠を日付ごとにまとめる（日報モーダルで待機保証の対象者を並べるのに使う）
      const shiftRows = (shiftData || []) as ShiftRow[]
      const shiftMap: Record<string, ShiftRow[]> = {}
      shiftRows.forEach(sh => {
        if (!shiftMap[sh.date]) shiftMap[sh.date] = []
        shiftMap[sh.date].push(sh)
      })

      // 控除・手当・ペナルティ・待機保証の実績を日付ごとにまとめる。
      // 利益への影響は amount の符号そのまま（控除・ペナルティ＝マイナス、手当・保証＝プラス）を
      // 逆にした値（＝プラスなら利益が増える方向）として合計する。
      const adjustmentRows = (memoData || []) as AdjustmentRow[]
      const adjustmentMap: Record<string, AdjustmentRow[]> = {}
      const adjustmentDayTotals: Record<string, { profitImpact: number; count: number }> = {}
      adjustmentRows.forEach(a => {
        if (!adjustmentMap[a.date]) adjustmentMap[a.date] = []
        adjustmentMap[a.date].push(a)
        if (!adjustmentDayTotals[a.date]) adjustmentDayTotals[a.date] = { profitImpact: 0, count: 0 }
        adjustmentDayTotals[a.date].profitImpact += -(a.amount || 0)
        adjustmentDayTotals[a.date].count++
      })

      // 表示名。他店舗所属のセラピストがヘルプ出勤しているとこの店舗の therapists には
      // 載らないため、出勤枠・調整実績に出てくる未知のIDだけ追加で引く。
      const nameMap: Record<string, string> = {}
      ;(therapists || []).forEach(t => { nameMap[t.id] = t.name })
      const missingIds = [...new Set([
        ...shiftRows.map(sh => sh.therapist_id),
        ...adjustmentRows.map(a => a.therapist_id),
      ].filter(id => id && !nameMap[id]))]
      if (missingIds.length > 0) {
        const { data: extraTherapists } = await supabase
          .from('therapists')
          .select('id, name')
          .in('id', missingIds)
        ;(extraTherapists || []).forEach(t => { nameMap[t.id] = t.name })
      }

      setShiftsByDate(shiftMap)
      setAdjustmentsByDate(adjustmentMap)
      setTherapistNames(nameMap)
      setTherapistOptions(
        [...new Set([...(therapists || []).map(t => t.id), ...Object.keys(nameMap)])]
          .map(id => ({ id, name: nameMap[id] || '' }))
          .filter(t => t.name)
          .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
      )
      setDefaultStandbyAmount(settingsData?.[0]?.standby_guarantee_amount ?? 0)
      // 段階テーブルが未作成でも集計は止めない（定額にフォールバックする）
      setStandbyTiers(((tierData || []) as { min_hours: number | string; amount: number }[])
        .map(t => ({ min_hours: Number(t.min_hours), amount: Number(t.amount) })))

      const results: DailySummary[] = []
      const calculatedResList: CalculatedReservation[] = []
      const current = new Date(start)
      while (current <= end) {
        const dStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
        const dayRes = dailyMap[dStr] || []
        
        let daySales = 0
        let dayCashSales = 0
        let dayCreditSales = 0
        let dayPaypaySales = 0
        let dayCreditCount = 0
        let dayPaypayCount = 0
        let dayBack = 0
        let dayCount = dayRes.length
        let dayCreditFee = 0
        let dayPaypayFee = 0

        for (const res of dayRes) {
          const therapist = therapists?.find(t => t.id === res.therapist_id)
          dayCreditFee += res.credit_fee_amount || 0
          dayPaypayFee += res.paypay_fee_amount || 0

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

          const optComponent = res.options_price ?? (res.reservation_options?.reduce((sum, o) => sum + (o.price || 0), 0) || 0);
          // 本体（オプション以外）とオプションを、それぞれの支払方法のバケットに振り分ける
          const mainComponent = calculatedTotalPrice - optComponent;
          let resCreditSales = 0;
          let resPaypaySales = 0;
          let resCashSales = 0;
          let hasCredit = false;
          let hasPaypay = false;

          const addSales = (method: 'cash' | 'credit' | 'paypay' | null, amount: number) => {
            if (method === 'credit') { resCreditSales += amount; hasCredit = true; }
            else if (method === 'paypay') { resPaypaySales += amount; hasPaypay = true; }
            else resCashSales += amount;
          };
          addSales(res.payment_method, mainComponent);
          addSales(res.options_payment_method, optComponent);

          dayCreditSales += resCreditSales;
          dayPaypaySales += resPaypaySales;
          dayCashSales += resCashSales;
          if (hasCredit) dayCreditCount++;
          if (hasPaypay) dayPaypayCount++;

          calculatedResList.push({
            ...res,
            therapistName: therapist ? therapist.name : '（未割当）',
            calculatedTotalPrice,
            calculatedNetBack,
            calculatedShopProfit: calculatedTotalPrice - calculatedNetBack,
          })
        }

        const dayAdjustment = adjustmentDayTotals[dStr] || { profitImpact: 0, count: 0 }

        results.push({
          date: dStr,
          totalSales: daySales,
          cashSales: dayCashSales,
          creditCount: dayCreditCount,
          creditSales: dayCreditSales,
          paypayCount: dayPaypayCount,
          paypaySales: dayPaypaySales,
          totalBack: dayBack,
          shopProfit: daySales - dayBack + dayAdjustment.profitImpact,
          reservationCount: dayCount,
          totalCreditFee: dayCreditFee,
          totalPaypayFee: dayPaypayFee,
          adjustmentTotal: dayAdjustment.profitImpact,
          adjustmentCount: dayAdjustment.count,
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

  /** その日・そのセラピストに既に登録されている待機保証（category='standby_guarantee'）を探す */
  const findGuaranteeAdjustment = (date: string, therapistId: string): AdjustmentRow | undefined =>
    (adjustmentsByDate[date] || []).find(a => a.therapist_id === therapistId && a.category === 'standby_guarantee')

  /** 待機保証を登録・更新する（予約0本の出勤者ウィジェットから呼ばれる）。金額は入力欄から受け取る */
  const handleSaveStandby = async (date: string, therapistId: string) => {
    if (!selectedShop) return
    if (adjustmentsUnavailable) {
      alert('区分（category）列がまだ作成されていません。scripts/db-migrate-adjustment-category.ts を実行してください。')
      return
    }
    const key = standbyKey(date, therapistId)
    const existing = findGuaranteeAdjustment(date, therapistId)
    const shift = (shiftsByDate[date] || []).find(sh => sh.therapist_id === therapistId)
    const waitHours = calcStandbyHours(shift?.start_time, shift?.end_time)
    const suggested = existing?.amount
      ?? resolveStandbyAmount(waitHours, standbyTiers, defaultStandbyAmount)
    const raw = standbyDrafts[key] ?? String(suggested)
    const amount = Math.max(0, Math.floor(Number(raw) || 0))

    if (amount <= 0) {
      alert('金額を入力してください。')
      return
    }

    const content = existing?.content
      ?? `待機保証${waitHours !== null ? `（待機${Number.isInteger(waitHours) ? waitHours : waitHours.toFixed(1)}時間）` : ''}`

    setSavingStandbyKey(key)
    try {
      const { error } = existing
        ? await supabase
            .from('therapist_memos')
            .update({ amount })
            .eq('id', existing.id)
        : await supabase
            .from('therapist_memos')
            .insert([{
              shop_id: selectedShop.id,
              therapist_id: therapistId,
              date,
              content,
              amount,
              category: 'standby_guarantee',
              created_by_id: user?.id ?? null,
            }])

      if (error) { alert('待機保証の保存に失敗しました: ' + error.message); return }
      await handleCalculate()
    } finally {
      setSavingStandbyKey(null)
    }
  }

  /** 登録済みの待機保証を取り消す */
  const handleDeleteStandby = async (date: string, therapistId: string) => {
    const key = standbyKey(date, therapistId)
    const existing = findGuaranteeAdjustment(date, therapistId)
    if (!existing) return
    if (!confirm('この待機保証を取り消しますか？')) return

    setSavingStandbyKey(key)
    try {
      const { error } = await supabase.from('therapist_memos').delete().eq('id', existing.id)
      if (error) { alert('待機保証の取り消しに失敗しました: ' + error.message); return }
      setStandbyDrafts(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      await handleCalculate()
    } finally {
      setSavingStandbyKey(null)
    }
  }

  /**
   * 控除・手当・ペナルティを手動で追加する（日報モーダルの「＋ 手動で追加」フォーム）。
   * 毎日決まって発生するルールがある店舗はほぼ無いため、対象者・区分・金額・理由を
   * その場で自由に決めて登録できるようにしている。
   */
  const handleAddAdjustment = async () => {
    if (!selectedShop || !selectedDate || !newAdjustment) return
    if (!newAdjustment.therapistId) { alert('セラピストを選択してください。'); return }
    if (!newAdjustment.content.trim()) { alert('理由・内容を入力してください。'); return }
    const magnitude = Math.floor(Number(newAdjustment.amount) || 0)
    if (magnitude <= 0) { alert('金額を入力してください。'); return }

    // 控除・ペナルティ＝セラピストへの支払いから引く（マイナス）、手当・待機保証＝上乗せする（プラス）。
    // 「その他」だけ、どちら向きか自明ではないので手動で選んだ符号を使う。
    const signedAmount = newAdjustment.category === 'deduction' || newAdjustment.category === 'penalty'
      ? -magnitude
      : newAdjustment.category === 'allowance' || newAdjustment.category === 'standby_guarantee'
        ? magnitude
        : newAdjustment.sign * magnitude

    setSavingAdjustment(true)
    try {
      const { error } = await supabase.from('therapist_memos').insert([{
        shop_id: selectedShop.id,
        therapist_id: newAdjustment.therapistId,
        date: selectedDate,
        content: newAdjustment.content.trim(),
        amount: signedAmount,
        category: newAdjustment.category === 'other' ? null : newAdjustment.category,
        created_by_id: user?.id ?? null,
      }])
      if (error) { alert('調整の追加に失敗しました: ' + error.message); return }
      setNewAdjustment(null)
      await handleCalculate()
    } finally {
      setSavingAdjustment(false)
    }
  }

  const handleEditAdjustmentStart = (row: AdjustmentRow) => {
    setEditingAdjustmentId(row.id)
    setEditAdjustmentForm({ content: row.content, amount: String(row.amount) })
  }

  const handleUpdateAdjustment = async (id: string) => {
    if (!editAdjustmentForm.content.trim()) { alert('理由・内容を入力してください。'); return }
    const amount = Math.floor(Number(editAdjustmentForm.amount) || 0)

    setSavingAdjustment(true)
    try {
      const { error } = await supabase
        .from('therapist_memos')
        .update({ content: editAdjustmentForm.content.trim(), amount })
        .eq('id', id)
      if (error) { alert('調整の更新に失敗しました: ' + error.message); return }
      setEditingAdjustmentId(null)
      await handleCalculate()
    } finally {
      setSavingAdjustment(false)
    }
  }

  const handleDeleteAdjustment = async (id: string) => {
    if (!confirm('この調整を削除しますか？')) return
    setSavingAdjustment(true)
    try {
      const { error } = await supabase.from('therapist_memos').delete().eq('id', id)
      if (error) { alert('調整の削除に失敗しました: ' + error.message); return }
      await handleCalculate()
    } finally {
      setSavingAdjustment(false)
    }
  }

  useEffect(() => {
    handleCalculate()
  }, [selectedShop, selectedMonth, closingDate])

  const totals = useMemo(() => {
    let sales = 0
    let cashSales = 0
    let creditCount = 0
    let creditSales = 0
    let paypayCount = 0
    let paypaySales = 0
    let back = 0
    let adjustmentTotal = 0
    let adjustmentCount = 0
    let profit = 0
    let count = 0
    let creditFee = 0
    let paypayFee = 0
    let mtsCount = 0
    let ownerCount = 0
    let therapistCount = 0
    let clientCount = 0

    dailySummaries.forEach(cur => {
      sales += cur.totalSales
      cashSales += cur.cashSales
      creditCount += cur.creditCount
      creditSales += cur.creditSales
      paypayCount += cur.paypayCount
      paypaySales += cur.paypaySales
      back += cur.totalBack
      adjustmentTotal += cur.adjustmentTotal
      adjustmentCount += cur.adjustmentCount
      profit += cur.shopProfit
      count += cur.reservationCount
      creditFee += cur.totalCreditFee
      paypayFee += cur.totalPaypayFee
    })

    calculatedReservations.forEach(res => {
      if (res.reception_source === 'staff') {
        mtsCount++
      } else if (res.reception_source === 'owner' || res.reception_source?.startsWith('owner_')) {
        ownerCount++
      } else if (res.reception_source === 'therapist') {
        therapistCount++
      } else {
        clientCount++
      }
    })

    return {
      sales,
      cashSales,
      creditCount,
      creditSales,
      paypayCount,
      paypaySales,
      back,
      adjustmentTotal,
      adjustmentCount,
      profit,
      count,
      creditFee,
      paypayFee,
      mtsCount,
      ownerCount,
      therapistCount,
      clientCount
    }
  }, [dailySummaries, calculatedReservations])
  const renderTable = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto animate-in fade-in duration-500">
      <table className="w-full text-left border-collapse whitespace-nowrap min-w-[1100px]">
        <thead className="bg-slate-50">
          <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <th className="px-4 py-3 border-b border-slate-100">日付</th>
            <th className="px-4 py-3 border-b border-slate-100">売上合計</th>
            <th className="px-4 py-3 border-b border-slate-100">現金売上</th>
            <th className="px-4 py-3 border-b border-slate-100">クレジット売上</th>
            <th className="px-4 py-3 border-b border-slate-100">クレ手数料</th>
            <th className="px-4 py-3 border-b border-slate-100">クレ件数</th>
            <th className="px-4 py-3 border-b border-slate-100">PayPay売上</th>
            <th className="px-4 py-3 border-b border-slate-100">PayPay手数料</th>
            <th className="px-4 py-3 border-b border-slate-100">PayPay件数</th>
            <th className="px-4 py-3 border-b border-slate-100 text-indigo-600">報酬</th>
            <th className="px-4 py-3 border-b border-slate-100">調整</th>
            <th className="px-4 py-3 border-b border-slate-100 text-emerald-600">利益</th>
            <th className="px-4 py-3 border-b border-slate-100">件数</th>
            <th className="px-2 py-3 border-b border-slate-100 w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {dailySummaries.map((day) => (
            <tr key={day.date} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700 font-mono text-xs">{day.date.slice(5).replace('-', '/')}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    new Date(day.date).getDay() === 0 ? 'text-rose-500 bg-rose-50' : 
                    new Date(day.date).getDay() === 6 ? 'text-indigo-500 bg-indigo-50' : 'text-slate-400 bg-slate-50'
                  }`}>
                    {new Date(day.date).toLocaleDateString('ja-JP', { weekday: 'short' })}
                  </span>
                </div>
              </td>
              <td className="px-4 py-2 font-mono text-xs font-bold text-slate-700">¥{day.totalSales.toLocaleString()}</td>
              <td className="px-4 py-2 font-mono text-xs text-slate-600">¥{day.cashSales.toLocaleString()}</td>
              <td className="px-4 py-2 font-mono text-xs text-slate-600">¥{day.creditSales.toLocaleString()}</td>
              <td className="px-4 py-2 font-mono text-xs text-amber-500">¥{day.totalCreditFee.toLocaleString()}</td>
              <td className="px-4 py-2 font-mono text-xs text-slate-600">{day.creditCount}件</td>
              <td className="px-4 py-2 font-mono text-xs text-slate-600">¥{day.paypaySales.toLocaleString()}</td>
              <td className="px-4 py-2 font-mono text-xs text-red-500">¥{day.totalPaypayFee.toLocaleString()}</td>
              <td className="px-4 py-2 font-mono text-xs text-slate-600">{day.paypayCount}件</td>
              <td className="px-4 py-2 font-mono text-xs font-bold text-indigo-600">¥{day.totalBack.toLocaleString()}</td>
              <td className={`px-4 py-2 font-mono text-xs ${day.adjustmentTotal < 0 ? 'text-rose-600' : day.adjustmentTotal > 0 ? 'text-slate-600' : ''}`}>
                {day.adjustmentCount > 0 ? (
                  <span className="font-bold">
                    {day.adjustmentTotal >= 0 ? '+' : ''}¥{day.adjustmentTotal.toLocaleString()}
                    <span className="text-slate-400 font-medium ml-1">({day.adjustmentCount}件)</span>
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className="px-4 py-2 font-mono text-xs font-bold text-emerald-600">¥{day.shopProfit.toLocaleString()}</td>
              <td className="px-4 py-2 font-mono text-xs text-slate-600">{day.reservationCount}件</td>
              <td className="px-2 py-2 text-center">
                <button 
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className="text-slate-300 hover:text-indigo-600 transition-colors p-1"
                  title="詳細明細を表示（日報）"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
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

        {adjustmentsUnavailable && (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-medium">
            控除・手当・ペナルティ・待機保証の区分列（therapist_memos.category）がデータベースにありません。
            <code className="mx-1 px-1.5 py-0.5 bg-amber-100 rounded font-mono">npx tsx scripts/db-migrate-adjustment-category.ts</code>
            を実行するまで、この機能の入力・集計は無効です（他の集計はそのまま使えます）。
          </div>
        )}

        {/* サマリーダッシュボード */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* 売上カード */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-700 text-sm">売上実績</h3>
              </div>
              
              <div className="mb-4">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">売上合計</div>
                <div className="text-3xl font-bold text-slate-800 font-mono tracking-tight">¥{totals.sales.toLocaleString()}</div>
              </div>
            </div>

            <div className="space-y-2.5 pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <div className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  現金売上
                </div>
                <div className="text-sm font-bold text-slate-700 font-mono">¥{totals.cashSales.toLocaleString()}</div>
              </div>
              
              <div className="flex justify-between items-start">
                <div className="text-xs text-slate-600 font-medium flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  クレジット売上
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-700 font-mono">¥{totals.creditSales.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                    {totals.creditCount}件 / 手数料: <span className="text-amber-600">¥{totals.creditFee.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-start">
                <div className="text-xs text-slate-600 font-medium flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  PayPay売上
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-700 font-mono">¥{totals.paypaySales.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                    {totals.paypayCount}件 / 手数料: <span className="text-red-500">¥{totals.paypayFee.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 収支カード */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-0 opacity-50"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-700 text-sm">収支状況</h3>
              </div>

              <div className="mb-4">
                <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">店舗利益 (店落ち)</div>
                <div className="text-3xl font-bold text-emerald-600 font-mono tracking-tight">¥{totals.profit.toLocaleString()}</div>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-100 relative z-10">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-xs text-slate-600 font-bold">
                  報酬合計
                </div>
                <div className="text-sm font-bold text-indigo-600 font-mono">¥{totals.back.toLocaleString()}</div>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="text-xs text-slate-600 font-bold">
                  控除・手当調整
                  {totals.adjustmentCount > 0 && (
                    <span className="text-[10px] text-slate-400 font-medium ml-1.5">{totals.adjustmentCount}件</span>
                  )}
                </div>
                <div className={`text-sm font-bold font-mono ${totals.adjustmentTotal < 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                  {totals.adjustmentTotal >= 0 ? '+' : ''}¥{totals.adjustmentTotal.toLocaleString()}
                </div>
              </div>
              <div className="text-[10px] text-slate-400 px-1 text-center font-medium mt-1">
                ※利益 ＝ 売上合計 － 報酬合計 ＋ 控除・手当調整（控除・ペナルティは＋、手当・待機保証は－）
              </div>
            </div>
          </div>

          {/* 稼働カード */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-700 text-sm">稼働実績</h3>
              </div>

              <div className="mb-4">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">総予約数</div>
                <div className="flex items-baseline gap-1.5">
                  <div className="text-3xl font-bold text-slate-800 font-mono tracking-tight">{totals.count}</div>
                  <div className="text-xs text-slate-500 font-bold">件</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-100">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
                <div className="text-[10px] text-slate-500 font-bold mb-0.5">WEB/その他</div>
                <div className="text-sm font-bold text-slate-700 font-mono">{totals.clientCount}件</div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
                <div className="text-[10px] text-slate-500 font-bold mb-0.5">代行 (mts)</div>
                <div className="text-sm font-bold text-slate-700 font-mono">{totals.mtsCount}件</div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
                <div className="text-[10px] text-slate-500 font-bold mb-0.5">姫予約</div>
                <div className="text-sm font-bold text-slate-700 font-mono">{totals.therapistCount}件</div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
                <div className="text-[10px] text-slate-500 font-bold mb-0.5">オーナー</div>
                <div className="text-sm font-bold text-slate-700 font-mono">{totals.ownerCount}件</div>
              </div>
            </div>
          </div>
        </div>

        {/* 1列レイアウトの日別明細 */}
        <div className="w-full">
          {renderTable()}
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
        // 日別サマリーは business_date（無ければ date）で束ねているので、明細も同じ基準で絞る。
        // ここがずれると「予約0本」の判定と上の明細一覧が食い違う。
        const dayReservations = calculatedReservations.filter(r => (r.business_date || r.date) === selectedDate)
        const summary = dailySummaries.find(d => d.date === selectedDate) || {
          date: selectedDate,
          totalSales: 0,
          cashSales: 0,
          creditCount: 0,
          creditSales: 0,
          paypayCount: 0,
          paypaySales: 0,
          totalBack: 0,
          shopProfit: 0,
          reservationCount: 0,
          totalCreditFee: 0,
          totalPaypayFee: 0,
          adjustmentTotal: 0,
          adjustmentCount: 0
        } as DailySummary

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
              <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">売上合計</span>
                    <span className="text-base font-bold text-slate-800 font-mono">¥{summary.totalSales.toLocaleString()}</span>
                  </div>
                  <div className="text-[9px] text-slate-500 font-medium mt-1.5 flex justify-between border-t border-slate-100 pt-1">
                    <span>現金: ¥{summary.cashSales?.toLocaleString() || 0}</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">クレジット売上</span>
                    <span className="text-base font-bold text-slate-800 font-mono">¥{summary.creditSales?.toLocaleString() || 0}</span>
                  </div>
                  <div className="text-[9px] text-slate-500 font-medium mt-1.5 flex flex-col gap-0.5 border-t border-slate-100 pt-1">
                    <div className="flex justify-between">
                      <span>件数:</span>
                      <span>{summary.creditCount || 0}件</span>
                    </div>
                    {summary.totalCreditFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-amber-500">手数料:</span>
                        <span className="text-amber-500 font-bold">¥{summary.totalCreditFee.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">PayPay売上</span>
                    <span className="text-base font-bold text-slate-800 font-mono">¥{summary.paypaySales?.toLocaleString() || 0}</span>
                  </div>
                  <div className="text-[9px] text-slate-500 font-medium mt-1.5 flex flex-col gap-0.5 border-t border-slate-100 pt-1">
                    <div className="flex justify-between">
                      <span>件数:</span>
                      <span>{summary.paypayCount || 0}件</span>
                    </div>
                    {summary.totalPaypayFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-red-500">手数料:</span>
                        <span className="text-red-500 font-bold">¥{summary.totalPaypayFee.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">報酬合計</span>
                    <span className="text-base font-bold text-indigo-600 font-mono">¥{summary.totalBack.toLocaleString()}</span>
                  </div>
                  <div className="text-[9px] font-medium mt-1.5 flex flex-col gap-0.5 border-t border-slate-100 pt-1">
                    {summary.adjustmentCount > 0 && (
                      <div className={`flex justify-between ${summary.adjustmentTotal < 0 ? 'text-rose-500' : 'text-slate-500'}`}>
                        <span>調整:</span>
                        <span className="font-bold">{summary.adjustmentTotal >= 0 ? '+' : ''}¥{summary.adjustmentTotal.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-emerald-600">
                      <span>利益:</span>
                      <span className="font-bold">¥{summary.shopProfit.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">総予約数</span>
                    <span className="text-base font-bold text-slate-600 font-mono">{summary.reservationCount} 件</span>
                  </div>
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

                {/* 待機保証（予約0本の出勤者） */}
                {(() => {
                  const dayShifts = shiftsByDate[selectedDate] || []
                  const reservedIds = new Set(dayReservations.map(r => r.therapist_id))

                  // 同じ日に出勤枠が複数ある場合もセラピストは1行にまとめる
                  const candidates: ShiftRow[] = []
                  const seen = new Set<string>()
                  dayShifts
                    .filter(sh => sh.therapist_id && !reservedIds.has(sh.therapist_id))
                    .sort((a, b) => timeToSortValue(a.start_time || '') - timeToSortValue(b.start_time || ''))
                    .forEach(sh => {
                      if (seen.has(sh.therapist_id)) return
                      seen.add(sh.therapist_id)
                      candidates.push(sh)
                    })

                  // 支給後にシフトが消された・予約が後から入った場合でも、
                  // 支給済みの保証が画面から消えて取り消せなくならないように拾う
                  const orphans: ShiftRow[] = (adjustmentsByDate[selectedDate] || [])
                    .filter(a => a.category === 'standby_guarantee' && !seen.has(a.therapist_id))
                    .map(a => ({ therapist_id: a.therapist_id, date: selectedDate, start_time: null, end_time: null }))

                  const rows = [...candidates, ...orphans]
                  if (rows.length === 0) return null

                  return (
                    <div className="border border-rose-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                      <div className="bg-rose-50/60 px-4 py-3 border-b border-rose-200">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                          <span className="font-bold text-slate-800 text-sm">待機保証</span>
                          <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                            対象 {rows.length}名
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          この日に出勤していて予約が1本も入らなかったセラピストです。金額は待機時間から自動で入りますが、その場で書き換えられます。保存するとその日の利益から差し引かれます。
                        </p>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {rows.map((row) => {
                          const key = standbyKey(selectedDate, row.therapist_id)
                          const existing = findGuaranteeAdjustment(selectedDate, row.therapist_id)
                          const waitHours = calcStandbyHours(row.start_time, row.end_time)
                          const suggested = resolveStandbyAmount(waitHours, standbyTiers, defaultStandbyAmount)
                          const draft = standbyDrafts[key] ?? String(existing?.amount ?? suggested)
                          const busy = savingStandbyKey === key

                          return (
                            <div key={key} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-bold text-slate-800 text-sm truncate">
                                  {therapistNames[row.therapist_id] || '（不明なセラピスト）'}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {row.start_time
                                    ? `${toDisplayTime(row.start_time)}〜${toDisplayTime(row.end_time || '')}`
                                    : 'シフト登録なし'}
                                  {waitHours !== null && (
                                    <span className="ml-2 text-slate-500 font-bold">
                                      待機{Number.isInteger(waitHours) ? waitHours : waitHours.toFixed(1)}時間
                                    </span>
                                  )}
                                </div>
                                {!existing && suggested > 0 && (
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    規定額 ¥{suggested.toLocaleString()}
                                    {waitHours === null && standbyTiers.length > 0 && '（待機時間が取れないため定額）'}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {existing && (
                                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded whitespace-nowrap">
                                    支給済 ¥{existing.amount.toLocaleString()}
                                  </span>
                                )}
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">¥</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={500}
                                    value={draft}
                                    onChange={(e) => setStandbyDrafts(prev => ({ ...prev, [key]: e.target.value }))}
                                    className="w-32 border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 text-xs font-mono outline-none focus:ring-2 focus:ring-rose-500/40"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSaveStandby(selectedDate, row.therapist_id)}
                                  disabled={busy}
                                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] transition-colors disabled:opacity-50 whitespace-nowrap"
                                >
                                  {busy ? '保存中...' : existing ? '更新' : '支給'}
                                </button>
                                {existing && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteStandby(selectedDate, row.therapist_id)}
                                    disabled={busy}
                                    className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold rounded-lg text-[11px] transition-colors disabled:opacity-50"
                                  >
                                    取消
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* 控除・手当・ペナルティ・待機保証（一覧＋手動追加） */}
                {(() => {
                  const dayAdjustments = adjustmentsByDate[selectedDate] || []

                  return (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                          <span className="font-bold text-slate-800 text-sm">控除・手当・ペナルティ</span>
                          {dayAdjustments.length > 0 && (
                            <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                              {dayAdjustments.length}件
                            </span>
                          )}
                        </div>
                        {!newAdjustment && (
                          <button
                            type="button"
                            onClick={() => setNewAdjustment({ therapistId: '', category: 'deduction', sign: -1, content: '', amount: '' })}
                            disabled={adjustmentsUnavailable}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg text-[11px] transition-colors disabled:opacity-50"
                          >
                            ＋ 手動で追加
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 px-4 pt-2">
                        毎日決まって発生するものが無くても構いません。当欠・釣銭不足・不足分の補填など、
                        そのつど起きたことをここに記録すると、その日の利益に反映されます。
                      </p>

                      {/* 追加フォーム */}
                      {newAdjustment && (
                        <div className="mx-4 my-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <select
                              value={newAdjustment.therapistId}
                              onChange={(e) => setNewAdjustment(f => f && ({ ...f, therapistId: e.target.value }))}
                              className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-500/40"
                            >
                              <option value="">セラピストを選択</option>
                              {therapistOptions.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                            <select
                              value={newAdjustment.category}
                              onChange={(e) => setNewAdjustment(f => f && ({ ...f, category: e.target.value as typeof f.category }))}
                              className="border border-slate-200 rounded-lg px-2.5 py-2 text-xs bg-white outline-none focus:ring-2 focus:ring-indigo-500/40"
                            >
                              <option value="deduction">控除（支払いから引く）</option>
                              <option value="penalty">ペナルティ（支払いから引く）</option>
                              <option value="allowance">手当（上乗せする）</option>
                              <option value="standby_guarantee">待機保証（上乗せする）</option>
                              <option value="other">その他</option>
                            </select>
                          </div>
                          <input
                            type="text"
                            placeholder="理由・内容（例: 8/16当欠、釣銭不足など）"
                            value={newAdjustment.content}
                            onChange={(e) => setNewAdjustment(f => f && ({ ...f, content: e.target.value }))}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500/40"
                          />
                          <div className="flex items-center gap-2">
                            {newAdjustment.category === 'other' && (
                              <div className="flex rounded-lg border border-slate-200 overflow-hidden shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setNewAdjustment(f => f && ({ ...f, sign: -1 }))}
                                  className={`px-2.5 py-2 text-xs font-bold ${newAdjustment.sign === -1 ? 'bg-rose-600 text-white' : 'bg-white text-slate-500'}`}
                                >
                                  控除(－)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setNewAdjustment(f => f && ({ ...f, sign: 1 }))}
                                  className={`px-2.5 py-2 text-xs font-bold ${newAdjustment.sign === 1 ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500'}`}
                                >
                                  手当(＋)
                                </button>
                              </div>
                            )}
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">¥</span>
                              <input
                                type="number"
                                min={0}
                                step={500}
                                placeholder="金額"
                                value={newAdjustment.amount}
                                onChange={(e) => setNewAdjustment(f => f && ({ ...f, amount: e.target.value }))}
                                className="w-full border border-slate-200 rounded-lg pl-6 pr-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500/40"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleAddAdjustment}
                              disabled={savingAdjustment}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors disabled:opacity-50 whitespace-nowrap"
                            >
                              {savingAdjustment ? '保存中...' : '登録'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewAdjustment(null)}
                              className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold rounded-lg text-xs transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 一覧 */}
                      {dayAdjustments.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 text-xs font-medium">
                          この日の登録はありません
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {dayAdjustments.map((row) => {
                            const isEditing = editingAdjustmentId === row.id
                            const categoryLabel = row.category ? ADJUSTMENT_CATEGORY_LABELS[row.category] : 'その他'
                            const categoryColor = row.category ? ADJUSTMENT_CATEGORY_COLORS[row.category] : 'bg-slate-100 text-slate-600'

                            if (isEditing) {
                              return (
                                <div key={row.id} className="px-4 py-3 bg-indigo-50/40 space-y-2">
                                  <input
                                    type="text"
                                    value={editAdjustmentForm.content}
                                    onChange={(e) => setEditAdjustmentForm(f => ({ ...f, content: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500/40"
                                  />
                                  <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">¥</span>
                                      <input
                                        type="number"
                                        step={500}
                                        value={editAdjustmentForm.amount}
                                        onChange={(e) => setEditAdjustmentForm(f => ({ ...f, amount: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-lg pl-6 pr-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500/40"
                                      />
                                    </div>
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">マイナス＝控除、プラス＝手当</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateAdjustment(row.id)}
                                      disabled={savingAdjustment}
                                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] transition-colors disabled:opacity-50 whitespace-nowrap"
                                    >
                                      保存
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingAdjustmentId(null)}
                                      className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold rounded-lg text-[11px] transition-colors"
                                    >
                                      キャンセル
                                    </button>
                                  </div>
                                </div>
                              )
                            }

                            return (
                              <div key={row.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0 flex items-start gap-2">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${categoryColor}`}>
                                    {categoryLabel}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-800 text-sm truncate">
                                      {therapistNames[row.therapist_id] || '（不明なセラピスト）'}
                                    </div>
                                    <div className="text-[11px] text-slate-500 truncate">
                                      {row.content}
                                      {row.is_resolved && (
                                        <span className="ml-1.5 text-[10px] text-emerald-500 font-bold">精算済み</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-sm font-bold font-mono whitespace-nowrap ${row.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {row.amount >= 0 ? '+' : ''}¥{row.amount.toLocaleString()}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleEditAdjustmentStart(row)}
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-[11px] transition-colors"
                                  >
                                    編集
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAdjustment(row.id)}
                                    disabled={savingAdjustment}
                                    className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-slate-400 font-bold rounded-lg text-[11px] transition-colors disabled:opacity-50"
                                  >
                                    削除
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
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
