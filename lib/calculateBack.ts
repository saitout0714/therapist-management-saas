/**
 * バック金額算出エンジン
 *
 * 予約データから、セラピストのバック額と店舗の取り分を計算する。
 * 7ステップのアルゴリズムをデータベースのマスタ設定に基づいて実行する。
 */
import { supabase } from '@/lib/supabase'

// ============================================================
// Types
// ============================================================

type ShopBackRule = {
  course_calc_type: 'percentage' | 'fixed'
  course_back_rate: number
  option_calc_type: 'full_back' | 'percentage' | 'fixed' | 'per_item'
  option_back_rate: number
  nomination_calc_type: 'full_back' | 'percentage' | 'fixed'
  nomination_back_rate: number
  rounding_method: 'floor' | 'ceil' | 'round'
  business_day_cutoff: string
}

type RankBackRule = {
  course_back_rate: number | null
  option_back_rate: number | null
}

type TherapistBackOverride = {
  course_back_rate: number | null
  option_back_rate: number | null
  nomination_back_rate: number | null
  course_id: string | null
}

type CourseBackAmount = {
  back_amount: number
  customer_price: number | null
}

type OptionBackRule = {
  calc_type: 'full_back' | 'percentage' | 'fixed'
  back_rate: number | null
  back_amount: number | null
}

type ReservationDiscount = {
  applied_amount: number
  burden_type: 'shop_only' | 'split' | 'therapist_only'
}

type DeductionRule = {
  category: 'deduction' | 'allowance' | 'penalty'
  amount: number
  min_duration: number
}

type ReservationOption = {
  option_id: string
  price: number
}

export type BackCalculationInput = {
  shopId: string
  therapistId: string
  therapistRankId: string | null
  therapistBackCalcType: 'percentage' | 'fixed' | 'half_split' | null
  courseId: string
  coursePrice: number
  courseDuration: number
  designationType: string
  nominationFee: number
  options: ReservationOption[]
  discounts: ReservationDiscount[]
  date: string        // 'YYYY-MM-DD'
  startTime: string   // 'HH:MM'
}

export type BackCalculationResult = {
  courseBack: number
  optionBack: number
  nominationBack: number
  totalBack: number
  deductions: number
  allowances: number
  netBack: number
  shopRevenue: number
  totalPrice: number
  businessDate: string
  appliedRate: number | null  // 適用されたバック率（percentage方式の場合）
  calcMethod: string          // 計算方式の説明テキスト
}

// ============================================================
// Rounding helper
// ============================================================

function applyRounding(value: number, method: 'floor' | 'ceil' | 'round'): number {
  switch (method) {
    case 'floor': return Math.floor(value)
    case 'ceil':  return Math.ceil(value)
    case 'round': return Math.round(value)
    default:      return Math.floor(value)
  }
}

// ============================================================
// Main calculation function
// ============================================================

export async function calculateBack(input: BackCalculationInput): Promise<BackCalculationResult> {
  // Step 0: 営業日の決定
  const shopRule = await fetchShopBackRule(input.shopId)
  if (!shopRule) throw new Error('店舗のバック設定が見つかりません')

  const businessDate = resolveBusinessDate(
    input.date,
    input.startTime,
    shopRule.business_day_cutoff
  )

  // Step 1: 適用バック率の解決（オーバーライドチェーン）
  const resolved = await resolveBackRates(
    input.shopId,
    input.therapistId,
    input.therapistRankId,
    input.therapistBackCalcType,
    input.courseId,
    shopRule
  )

  let courseBack = 0
  let optionBack = 0
  let nominationBack = 0
  let calcMethod = ''

  // Step 5b: 折半方式の場合は先に処理
  if (resolved.calcType === 'half_split') {
    const totalOptionsPrice = input.options.reduce((sum, o) => sum + o.price, 0)
    const totalDiscount = input.discounts.reduce((sum, d) => sum + d.applied_amount, 0)
    const totalSales = input.coursePrice + totalOptionsPrice + input.nominationFee - totalDiscount
    const totalBack = applyRounding(totalSales * resolved.courseRate / 100, shopRule.rounding_method)

    const deductionResult = await calculateDeductions(input.shopId, input.courseDuration)

    return {
      courseBack: totalBack,
      optionBack: 0,
      nominationBack: 0,
      totalBack,
      deductions: deductionResult.deductions,
      allowances: deductionResult.allowances,
      netBack: totalBack - deductionResult.deductions + deductionResult.allowances,
      shopRevenue: totalSales - totalBack,
      totalPrice: totalSales + totalDiscount,
      businessDate,
      appliedRate: resolved.courseRate,
      calcMethod: `総売上折半方式（${resolved.courseRate}%）`,
    }
  }

  // Step 2: コースバック額の算出
  if (resolved.calcType === 'percentage') {
    // 割引処理: split方式の場合は割引後で計算
    let effectiveCoursePrice = input.coursePrice
    for (const d of input.discounts) {
      if (d.burden_type === 'split') {
        effectiveCoursePrice -= d.applied_amount
      }
    }
    effectiveCoursePrice = Math.max(0, effectiveCoursePrice)
    courseBack = applyRounding(effectiveCoursePrice * resolved.courseRate / 100, shopRule.rounding_method)
    calcMethod = `パーセンテージ（${resolved.courseRate}%）`
  } else if (resolved.calcType === 'fixed') {
    const fixedAmount = await fetchCourseBackAmount(
      input.shopId,
      input.courseId,
      input.therapistRankId,
      input.designationType
    )
    if (fixedAmount) {
      courseBack = fixedAmount.back_amount
      calcMethod = `固定額（¥${fixedAmount.back_amount.toLocaleString()}）`
    } else {
      calcMethod = '固定額（未設定 → 0円）'
    }
  }

  // Step 3: オプションバック額の算出
  for (const opt of input.options) {
    const optRule = await fetchOptionBackRule(input.shopId, opt.option_id)

    if (optRule) {
      switch (optRule.calc_type) {
        case 'full_back':
          optionBack += opt.price
          break
        case 'percentage':
          optionBack += applyRounding(opt.price * (optRule.back_rate || 0) / 100, shopRule.rounding_method)
          break
        case 'fixed':
          optionBack += optRule.back_amount || 0
          break
      }
    } else {
      // 店舗デフォルト設定で計算
      switch (shopRule.option_calc_type) {
        case 'full_back':
          optionBack += opt.price
          break
        case 'percentage':
          optionBack += applyRounding(opt.price * shopRule.option_back_rate / 100, shopRule.rounding_method)
          break
        default:
          optionBack += opt.price // フルバックにフォールバック
      }
    }
  }

  // Step 4: 指名料バック額の算出
  if (input.nominationFee > 0) {
    switch (shopRule.nomination_calc_type) {
      case 'full_back':
        nominationBack = input.nominationFee
        break
      case 'percentage':
        const nomRate = resolved.nominationRate ?? shopRule.nomination_back_rate
        nominationBack = applyRounding(input.nominationFee * nomRate / 100, shopRule.rounding_method)
        break
      default:
        nominationBack = input.nominationFee
    }
  }

  // Step 5: 割引の負担処理（shop_only / therapist_only）
  let shopDiscountBurden = 0
  let therapistDiscountBurden = 0
  for (const d of input.discounts) {
    if (d.burden_type === 'shop_only') {
      shopDiscountBurden += d.applied_amount
    } else if (d.burden_type === 'therapist_only') {
      therapistDiscountBurden += d.applied_amount
    }
    // 'split' は Step 2 で既に処理済み
  }

  const totalBack = courseBack + optionBack + nominationBack - therapistDiscountBurden

  // Step 6: 予約単位の控除・手当処理
  const deductionResult = await calculateDeductions(input.shopId, input.courseDuration)

  // Step 7: 結果の構築
  const totalDiscount = input.discounts.reduce((sum, d) => sum + d.applied_amount, 0)
  const totalOptionsPrice = input.options.reduce((sum, o) => sum + o.price, 0)
  const totalPrice = input.coursePrice + totalOptionsPrice + input.nominationFee - totalDiscount

  const netBack = totalBack - deductionResult.deductions + deductionResult.allowances
  const shopRevenue = totalPrice - totalBack + therapistDiscountBurden

  return {
    courseBack,
    optionBack,
    nominationBack,
    totalBack: Math.max(0, totalBack),
    deductions: deductionResult.deductions,
    allowances: deductionResult.allowances,
    netBack: Math.max(0, netBack),
    shopRevenue: Math.max(0, shopRevenue),
    totalPrice: Math.max(0, totalPrice),
    businessDate,
    appliedRate: resolved.calcType === 'percentage' ? resolved.courseRate : null,
    calcMethod,
  }
}

// ============================================================
// Helper: Resolve business date
// ============================================================

function resolveBusinessDate(date: string, startTime: string, cutoff: string): string {
  const [cutH, cutM] = cutoff.split(':').map(Number)
  const [startH, startM] = startTime.split(':').map(Number)

  const cutMinutes = cutH * 60 + cutM
  const startMinutes = startH * 60 + startM

  if (startMinutes < cutMinutes) {
    // 営業日は前日
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }
  return date
}

// ============================================================
// Helper: Resolve back rates (override chain)
// ============================================================

type ResolvedRates = {
  calcType: 'percentage' | 'fixed' | 'half_split'
  courseRate: number
  optionRate: number | null
  nominationRate: number | null
}

async function resolveBackRates(
  shopId: string,
  therapistId: string,
  rankId: string | null,
  therapistCalcType: string | null,
  courseId: string,
  shopRule: ShopBackRule,
): Promise<ResolvedRates> {
  // 折半セラピストは最優先でショートサーキット
  if (therapistCalcType === 'half_split') {
    // 個別オーバーライドでバック率を取得
    const override = await fetchTherapistOverride(therapistId, courseId)
    return {
      calcType: 'half_split',
      courseRate: override?.course_back_rate ?? 50,
      optionRate: null,
      nominationRate: null,
    }
  }

  // 1a. セラピスト個別オーバーライド
  const override = await fetchTherapistOverride(therapistId, courseId)
  if (override && override.course_back_rate !== null) {
    return {
      calcType: 'percentage',
      courseRate: override.course_back_rate,
      optionRate: override.option_back_rate,
      nominationRate: override.nomination_back_rate,
    }
  }

  // 1b. ランク別オーバーライド
  if (rankId) {
    const rankRule = await fetchRankBackRule(shopId, rankId)
    if (rankRule && rankRule.course_back_rate !== null) {
      return {
        calcType: shopRule.course_calc_type,
        courseRate: rankRule.course_back_rate,
        optionRate: rankRule.option_back_rate,
        nominationRate: null,
      }
    }
  }

  // 1c. 店舗デフォルト
  return {
    calcType: shopRule.course_calc_type,
    courseRate: Number(shopRule.course_back_rate),
    optionRate: null,
    nominationRate: null,
  }
}

// ============================================================
// Helper: Calculate deductions for a reservation
// ============================================================

async function calculateDeductions(shopId: string, courseDuration: number) {
  const { data } = await supabase
    .from('deduction_rules')
    .select('*')
    .eq('shop_id', shopId)
    .eq('calc_timing', 'per_reservation')
    .eq('is_active', true)

  let deductions = 0
  let allowances = 0

  if (data) {
    for (const rule of data as DeductionRule[]) {
      if (courseDuration >= rule.min_duration) {
        if (rule.category === 'deduction' || rule.category === 'penalty') {
          deductions += rule.amount
        } else if (rule.category === 'allowance') {
          allowances += rule.amount
        }
      }
    }
  }

  return { deductions, allowances }
}

// ============================================================
// Data fetchers (cached per request in production)
// ============================================================

async function fetchShopBackRule(shopId: string): Promise<ShopBackRule | null> {
  const { data } = await supabase
    .from('shop_back_rules')
    .select('*')
    .eq('shop_id', shopId)
    .limit(1)
  return data?.[0] as ShopBackRule | null ?? null
}

async function fetchTherapistOverride(therapistId: string, courseId: string): Promise<TherapistBackOverride | null> {
  // コース固有の設定を優先
  const { data: specific } = await supabase
    .from('therapist_back_overrides')
    .select('*')
    .eq('therapist_id', therapistId)
    .eq('course_id', courseId)
    .limit(1)

  if (specific && specific.length > 0) return specific[0] as TherapistBackOverride

  // 全コース共通の設定にフォールバック
  const { data: general } = await supabase
    .from('therapist_back_overrides')
    .select('*')
    .eq('therapist_id', therapistId)
    .is('course_id', null)
    .limit(1)

  return general?.[0] as TherapistBackOverride | null ?? null
}

async function fetchRankBackRule(shopId: string, rankId: string): Promise<RankBackRule | null> {
  const { data } = await supabase
    .from('rank_back_rules')
    .select('*')
    .eq('shop_id', shopId)
    .eq('rank_id', rankId)
    .limit(1)
  return data?.[0] as RankBackRule | null ?? null
}

async function fetchCourseBackAmount(
  shopId: string, courseId: string, rankId: string | null, designationType: string
): Promise<CourseBackAmount | null> {
  // ランク指定ありで検索
  if (rankId) {
    const { data } = await supabase
      .from('course_back_amounts')
      .select('back_amount, customer_price')
      .eq('shop_id', shopId)
      .eq('course_id', courseId)
      .eq('rank_id', rankId)
      .eq('designation_type', designationType)
      .limit(1)
    if (data && data.length > 0) return data[0] as CourseBackAmount
  }

  // ランクNULL（全ランク共通）にフォールバック
  const { data } = await supabase
    .from('course_back_amounts')
    .select('back_amount, customer_price')
    .eq('shop_id', shopId)
    .eq('course_id', courseId)
    .is('rank_id', null)
    .eq('designation_type', designationType)
    .limit(1)
  return data?.[0] as CourseBackAmount | null ?? null
}

async function fetchOptionBackRule(shopId: string, optionId: string): Promise<OptionBackRule | null> {
  const { data } = await supabase
    .from('option_back_rules')
    .select('*')
    .eq('shop_id', shopId)
    .eq('option_id', optionId)
    .limit(1)
  return data?.[0] as OptionBackRule | null ?? null
}
