/**
 * バック金額算出エンジン v2
 *
 * 予約データから、セラピストのバック額と店舗の取り分を計算する。
 * 
 * v2 の主な変更点:
 * - customer_price を course_back_amounts から自動解決
 * - designation_type を slug ベースで柔軟に処理
 * - 姫予約ルールを designation_types マスタの設定で判定
 * - 予約登録時に自動実行して結果を reservations に保存
 */
import { supabase } from '@/lib/supabase'

// ============================================================
// Types
// ============================================================

type ShopBackRule = {
  course_calc_type: 'percentage' | 'fixed'
  course_back_rate: number
  course_back_amount?: number | null  // add-default-back-amounts.sql 以降の固定額列
  option_calc_type: 'full_back' | 'percentage' | 'fixed' | 'per_item'
  option_back_rate: number
  option_back_amount?: number | null
  nomination_calc_type: 'full_back' | 'percentage' | 'fixed'
  nomination_back_rate: number
  nomination_back_amount?: number | null
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
  course_price_override: number | null
}

type OptionBackRule = {
  calc_type: 'full_back' | 'percentage' | 'fixed'
  back_rate: number | null
  back_amount: number | null
}

type ReservationDiscount = {
  applied_amount: number
  burden_type: 'shop_only' | 'split' | 'therapist_only'
  therapist_burden_amount?: number | null  // 具体的なセラピスト負担額（設定時は burden_type より優先）
}

type DeductionRule = {
  category: 'deduction' | 'allowance' | 'penalty'
  amount: number
  min_duration: number
}

type ReservationOption = {
  option_id: string | null
  price: number
  custom_back_amount?: number  // カスタムオプション（option_id=null）のバック額
}

type DesignationType = {
  id: string
  slug: string
  display_name: string
  is_store_paid_back: boolean
  treats_as_confirmed: boolean
  default_fee: number | null
  default_back_amount: number | null
}

export type BackCalculationInput = {
  shopId: string
  therapistId: string
  therapistRankId: string | null
  therapistBackCalcType: 'percentage' | 'fixed' | 'half_split' | null
  courseId: string
  coursePrice: number             // コースのbase_price（フォールバック値）
  courseDuration: number
  designationType: string         // slug（'free', 'confirmed' etc.）
  nominationFee: number
  options: ReservationOption[]
  discounts: ReservationDiscount[]
  discountAmount?: number         // Fallback for old/manual discounts
  date: string                    // 'YYYY-MM-DD'
  startTime: string               // 'HH:MM'
  // 延長コース（サブコース）
  extensionCourseId?: string
  extensionCoursePrice?: number
  extensionCount?: number
  // 姫予約ボーナス
  himeBonus?: number
  // courses.back_amount（コース管理で設定したコース単位の固定バック額）
  courseBackAmount?: number
}

export type BackCalculationResult = {
  courseBack: number
  extensionBack: number
  optionBack: number
  nominationBack: number
  totalBack: number
  deductions: number
  allowances: number
  netBack: number
  himeBonus: number
  shopRevenue: number
  totalPrice: number
  resolvedCustomerPrice: number   // course_back_amounts から解決した顧客料金
  totalDiscount: number
  therapistDiscountBurden: number
  businessDate: string
  appliedRate: number | null
  calcMethod: string
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
// Customer Price Resolution
// ============================================================

/**
 * course_back_amounts テーブルから顧客料金（customer_price）を解決する。
 * 指名種別×ランク×コースの組み合わせで検索し、
 * 見つからなければコースのbase_priceをフォールバックとして返す。
 */
export async function resolveCustomerPrice(
  shopId: string,
  courseId: string,
  rankId: string | null,
  designationSlug: string,
  fallbackBasePrice: number
): Promise<{ customerPrice: number; backAmount: number | null; coursePriceOverride: number | null; source: 'matrix' | 'default' | 'fallback' }> {
  // 1. ランク指定ありで検索（マトリクス表）
  if (rankId) {
    const { data } = await supabase
      .from('course_back_amounts')
      .select('back_amount, customer_price, course_price_override')
      .eq('shop_id', shopId)
      .eq('course_id', courseId)
      .eq('rank_id', rankId)
      .eq('designation_type', designationSlug)
      .limit(1)
    if (data && data.length > 0) {
      const row = data[0] as CourseBackAmount
      return {
        customerPrice: row.customer_price ?? row.course_price_override ?? fallbackBasePrice,
        backAmount: row.back_amount,
        coursePriceOverride: row.course_price_override,
        source: 'matrix'
      }
    }
  }

  // 2. ランクNULL（全ランク共通）にフォールバック（マトリクス表）
  const { data: commonData } = await supabase
    .from('course_back_amounts')
    .select('back_amount, customer_price, course_price_override')
    .eq('shop_id', shopId)
    .eq('course_id', courseId)
    .is('rank_id', null)
    .eq('designation_type', designationSlug)
    .limit(1)
  if (commonData && commonData.length > 0) {
    const row = commonData[0] as CourseBackAmount
    return {
      customerPrice: row.customer_price ?? row.course_price_override ?? fallbackBasePrice,
      backAmount: row.back_amount,
      coursePriceOverride: row.course_price_override,
      source: 'matrix'
    }
  }

  // 3. 指名種別マスタのデフォルトを確認
  const { data: dtData } = await supabase
    .from('designation_types')
    .select('default_fee, default_back_amount')
    .eq('shop_id', shopId)
    .eq('slug', designationSlug)
    .limit(1)

  if (dtData && dtData.length > 0) {
    const dt = dtData[0]
    return {
      customerPrice: fallbackBasePrice + (dt.default_fee || 0),
      backAmount: dt.default_back_amount ?? null,
      coursePriceOverride: null,
      source: 'default'
    }
  }

  // 4. 最終フォールバック
  return { customerPrice: fallbackBasePrice, backAmount: null, coursePriceOverride: null, source: 'fallback' }
}


// ============================================================
// Helper: Resolve therapist option back rate (in-memory, no DB calls)
// ============================================================

function resolveTherapistOptionRate(
  backs: { option_category: string | null; designation_type: string | null; back_rate: number }[],
  category: string,
  designationType: string
): number | null {
  // 1. カテゴリ × 指名種別（最優先）
  const r1 = backs.find(b => b.option_category === category && b.designation_type === designationType)
  if (r1) return r1.back_rate
  // 2. カテゴリ × 全種別共通
  const r2 = backs.find(b => b.option_category === category && b.designation_type === null)
  if (r2) return r2.back_rate
  // 3. 全カテゴリ共通 × 指名種別
  const r3 = backs.find(b => b.option_category === null && b.designation_type === designationType)
  if (r3) return r3.back_rate
  // 4. 全カテゴリ × 全種別共通
  const r4 = backs.find(b => b.option_category === null && b.designation_type === null)
  if (r4) return r4.back_rate
  return null
}

// ============================================================
// Main calculation function
// ============================================================

export async function calculateBack(input: BackCalculationInput): Promise<BackCalculationResult> {
  // Step 0: 営業日の決定
  const shopRule = await fetchShopBackRule(input.shopId)
  if (!shopRule) throw new Error('店舗のバック設定の取得に失敗しました。システム管理者にお問い合わせください。')

  // Step 0c: セラピスト個別オプションバック設定とオプションカテゴリを一括取得
  const optionIds = input.options.filter(o => o.option_id).map(o => o.option_id as string)
  const [therapistOptBacksRes, optCategoriesRes] = await Promise.all([
    supabase.from('therapist_option_backs').select('option_category, designation_type, back_rate').eq('therapist_id', input.therapistId),
    optionIds.length > 0
      ? supabase.from('options').select('id, back_category').in('id', optionIds)
      : Promise.resolve({ data: [] as { id: string; back_category: string }[] }),
  ])
  const therapistOptBacks = (therapistOptBacksRes.data || []) as { option_category: string | null; designation_type: string | null; back_rate: number }[]
  const optCategoryMap = new Map((optCategoriesRes.data || []).map((o: { id: string; back_category: string }) => [o.id, o.back_category]))

  const businessDate = resolveBusinessDate(
    input.date,
    input.startTime,
    shopRule.business_day_cutoff
  )

  // Step 0b: 顧客料金の自動解決
  const resolved_price = await resolveCustomerPrice(
    input.shopId,
    input.courseId,
    input.therapistRankId,
    input.designationType,
    input.coursePrice
  )
  const effectiveCoursePrice = resolved_price.customerPrice

  // マトリクスにback_amountが設定されている場合、それを最優先で使用する。
  // customer_price（合計）はすでにコース料金+指名料を含むため、
  // 予約の nomination_fee を totalPrice に重ねて加算しない。
  const matrixBackUsed = resolved_price.source === 'matrix' && resolved_price.backAmount !== null

  // designation_types の default_fee がコース料金に折り込まれている場合、
  // 指名料部分を分離してバック計算を独立させる。
  const implicitNominationFee = (
    !matrixBackUsed &&
    input.nominationFee === 0 &&
    resolved_price.source === 'default' &&
    effectiveCoursePrice > input.coursePrice
  ) ? effectiveCoursePrice - input.coursePrice : 0
  const courseOnlyPrice = effectiveCoursePrice - implicitNominationFee
  const nominationFeeForBack = input.nominationFee + implicitNominationFee

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
  let extensionBack = 0
  let optionBack = 0
  let nominationBack = 0
  let extensionPrice = input.extensionCoursePrice || 0
  let calcMethod = ''

  // Step 5b: 折半方式の場合は先に処理
  if (resolved.calcType === 'half_split') {
    const totalOptionsPrice = input.options.reduce((sum, o) => sum + o.price, 0)
    const totalDiscount = (input.discounts && input.discounts.length > 0)
      ? input.discounts.reduce((sum, d) => sum + d.applied_amount, 0)
      : (input.discountAmount || 0)

    // Calculate extension if needed
    if (input.extensionCount && input.extensionCount > 0) {
      const { data: sysData } = await supabase.from('system_settings').select('extension_unit_price, extension_unit_back').eq('shop_id', input.shopId).limit(1)
      let extUnitPrice = sysData?.[0]?.extension_unit_price ?? 0
      let extUnitBack = sysData?.[0]?.extension_unit_back ?? 0
      if (input.therapistRankId) {
        const { data: rankData } = await supabase.from('extension_rank_prices').select('extension_unit_price, extension_unit_back').eq('shop_id', input.shopId).eq('rank_id', input.therapistRankId).limit(1)
        if (rankData && rankData.length > 0) {
          extUnitPrice = rankData[0].extension_unit_price
          extUnitBack = rankData[0].extension_unit_back
        }
      }
      extensionPrice += input.extensionCount * extUnitPrice
      extensionBack += input.extensionCount * extUnitBack
    }

    // 指名料は折半の対象外として計算（designation_types の default_back_amount があれば優先）
    const halfSplitNominationBack = (implicitNominationFee > 0 && resolved_price.backAmount !== null)
      ? resolved_price.backAmount
      : nominationFeeForBack
    // courses.back_amount が設定されていればコース部分は固定バック
    const courseHalfBack = (input.courseBackAmount && input.courseBackAmount > 0)
      ? input.courseBackAmount
      : applyRounding((courseOnlyPrice + extensionPrice + totalOptionsPrice - totalDiscount) * resolved.courseRate / 100, shopRule.rounding_method)
    const totalBack = courseHalfBack + halfSplitNominationBack

    const deductionResult = await calculateDeductions(input.shopId, input.courseDuration)

    const totalPrice = effectiveCoursePrice + extensionPrice + totalOptionsPrice + (matrixBackUsed ? 0 : input.nominationFee)
    return {
      courseBack: courseHalfBack,
      extensionBack: extensionBack,
      optionBack: 0,
      nominationBack: halfSplitNominationBack,
      totalBack: totalBack + extensionBack,
      deductions: deductionResult.deductions,
      allowances: deductionResult.allowances,
      netBack: totalBack + extensionBack - deductionResult.deductions + deductionResult.allowances,
      shopRevenue: totalPrice - totalDiscount - (totalBack + extensionBack),
      totalPrice: totalPrice - totalDiscount,
      resolvedCustomerPrice: effectiveCoursePrice,
      totalDiscount: totalDiscount,
      therapistDiscountBurden: 0,
      himeBonus: 0,
      businessDate,
      appliedRate: resolved.courseRate,
      calcMethod: `総売上折半方式（${resolved.courseRate}%）`,
    }
  }

  // Step 2: コースバック額の算出
  // 優先順: マトリクス設定(course_back_amounts.back_amount) > コース設定バック(courses.back_amount) > ショップレート計算
  // マトリクスに back_amount が設定されている場合は calc_type に関わらず最優先で使用
  if (matrixBackUsed) {
    courseBack = resolved_price.backAmount!
    calcMethod = `固定額（詳細設定: ¥${courseBack.toLocaleString()}）`
  } else if (resolved.calcType === 'percentage') {
    if (input.courseBackAmount && input.courseBackAmount > 0) {
      // courses.back_amount が設定されていれば固定バックとして優先
      courseBack = input.courseBackAmount
      calcMethod = `コース設定バック（¥${courseBack.toLocaleString()}）`
    } else {
      courseBack = applyRounding(courseOnlyPrice * resolved.courseRate / 100, shopRule.rounding_method)
      calcMethod = `パーセンテージ（${resolved.courseRate}%）`
    }
  } else if (resolved.calcType === 'fixed') {
    const fixedAmount = await fetchCourseBackAmount(
      input.shopId,
      input.courseId,
      input.therapistRankId,
      input.designationType
    )
    if (fixedAmount) {
      courseBack = fixedAmount.back_amount
      calcMethod = `固定額（詳細設定: ¥${courseBack.toLocaleString()}）`
    } else if (input.courseBackAmount && input.courseBackAmount > 0) {
      courseBack = input.courseBackAmount
      calcMethod = `コース設定バック（¥${courseBack.toLocaleString()}）`
    } else {
      calcMethod = '固定額（未設定 → 0円）'
    }
  }

  // Step 2b: 延長コースのバック計算
  if (input.extensionCourseId) {
    const extPrice = await resolveCustomerPrice(
      input.shopId,
      input.extensionCourseId,
      input.therapistRankId,
      'free', // 延長はfreeで統一
      input.extensionCoursePrice || 0
    )
    
    if (resolved.calcType === 'percentage') {
      extensionBack += applyRounding((extPrice.customerPrice) * resolved.courseRate / 100, shopRule.rounding_method)
    } else if (resolved.calcType === 'fixed') {
      extensionBack += extPrice.backAmount ?? 0
    }
  }

  // Step 2c: 延長回数の計算
  if (input.extensionCount && input.extensionCount > 0) {
    const { data: sysData } = await supabase.from('system_settings').select('extension_unit_price, extension_unit_back').eq('shop_id', input.shopId).limit(1)
    let extUnitPrice = sysData?.[0]?.extension_unit_price ?? 0
    let extUnitBack = sysData?.[0]?.extension_unit_back ?? 0
    if (input.therapistRankId) {
      const { data: rankData } = await supabase.from('extension_rank_prices').select('extension_unit_price, extension_unit_back').eq('shop_id', input.shopId).eq('rank_id', input.therapistRankId).limit(1)
      if (rankData && rankData.length > 0) {
        extUnitPrice = rankData[0].extension_unit_price
        extUnitBack = rankData[0].extension_unit_back
      }
    }
    extensionPrice += input.extensionCount * extUnitPrice
    extensionBack += input.extensionCount * extUnitBack
  }

  // Step 3: オプションバック額の算出
  for (const opt of input.options) {
    // カスタムオプション（手入力）: option_id がない場合は custom_back_amount をそのまま使用
    if (!opt.option_id) {
      optionBack += opt.custom_back_amount || 0
      continue
    }

    // セラピスト個別オプションバック設定を最優先で解決
    // 解決優先順位: カテゴリ×指名種別 > カテゴリ×全種別 > 全カテゴリ×指名種別 > 全カテゴリ×全種別 > shop default
    if (therapistOptBacks.length > 0) {
      const optCat = optCategoryMap.get(opt.option_id) ?? 'その他'
      const therapistRate = resolveTherapistOptionRate(therapistOptBacks, optCat, input.designationType)
      if (therapistRate !== null) {
        optionBack += applyRounding(opt.price * therapistRate, shopRule.rounding_method)
        continue
      }
    }

    // option_back_rules（オプション個別設定）にフォールバック
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

  // Step 4: 指名料バック額の算出（暗黙の指名料も含めて計算）
  // マトリクスの back_amount を使用した場合は指名料バックを別途計算しない
  // （back_amount がコース+指名料の合計バックとして設定されているため）
  if (!matrixBackUsed && nominationFeeForBack > 0) {
    // designation_types の default_back_amount が設定されている場合はそれを優先
    if (implicitNominationFee > 0 && resolved_price.backAmount !== null) {
      nominationBack = resolved_price.backAmount
    } else {
      switch (shopRule.nomination_calc_type) {
        case 'full_back':
          nominationBack = nominationFeeForBack
          break
        case 'percentage':
          const nomRate = resolved.nominationRate ?? shopRule.nomination_back_rate
          nominationBack = applyRounding(nominationFeeForBack * nomRate / 100, shopRule.rounding_method)
          break
        default:
          nominationBack = nominationFeeForBack
      }
    }
  }

  // Step 5: 割引の負担処理（shop_only / therapist_only / split）
  let shopDiscountBurden = 0
  let therapistDiscountBurden = 0
  let totalDiscount = 0

  if (input.discounts && input.discounts.length > 0) {
    for (const d of input.discounts) {
      totalDiscount += d.applied_amount
      if (d.therapist_burden_amount != null) {
        // 具体的な金額が指定されている場合はそちらを優先
        const tBurden = Math.min(d.therapist_burden_amount, d.applied_amount)
        therapistDiscountBurden += tBurden
        shopDiscountBurden += d.applied_amount - tBurden
      } else if (d.burden_type === 'shop_only') {
        shopDiscountBurden += d.applied_amount
      } else if (d.burden_type === 'therapist_only') {
        therapistDiscountBurden += d.applied_amount
      } else if (d.burden_type === 'split') {
        therapistDiscountBurden += Math.floor(d.applied_amount / 2)
        shopDiscountBurden += Math.ceil(d.applied_amount / 2)
      }
    }
  } else if (input.discountAmount && input.discountAmount > 0) {
    totalDiscount = input.discountAmount
    shopDiscountBurden = input.discountAmount
  }

  const totalBack = courseBack + extensionBack + optionBack + nominationBack - therapistDiscountBurden

  // Step 6: 予約単位の控除・手当処理
  const deductionResult = await calculateDeductions(input.shopId, input.courseDuration)

  // Step 7: 結果の構築
  const totalOptionsPrice = input.options.reduce((sum, o) => sum + o.price, 0)
  // マトリクスの customer_price（合計）を使用した場合は nomination_fee を加算しない（二重計上防止）
  const totalPrice = effectiveCoursePrice + extensionPrice + totalOptionsPrice + (matrixBackUsed ? 0 : input.nominationFee) - totalDiscount

  const himeBonus = input.himeBonus ?? 0
  const netBack = totalBack - deductionResult.deductions + deductionResult.allowances + himeBonus
  const shopRevenue = totalPrice - totalBack + therapistDiscountBurden

  return {
    courseBack,
    extensionBack,
    optionBack,
    nominationBack,
    totalBack: Math.max(0, totalBack),
    deductions: deductionResult.deductions,
    allowances: deductionResult.allowances,
    netBack: Math.max(0, netBack),
    himeBonus,
    shopRevenue: Math.max(0, shopRevenue),
    totalPrice: Math.max(0, totalPrice),
    resolvedCustomerPrice: effectiveCoursePrice,
    totalDiscount,
    therapistDiscountBurden,
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
  if (therapistCalcType === 'half_split') {
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

/**
 * シフトベースの手当を計算する（交通費など）
 */
export async function calculateShiftAllowances(shopId: string, therapistId: string, date: string): Promise<number> {
  // この日にこのセラピストはシフト入りしているか？
  const { data: shifts } = await supabase
    .from('shifts')
    .select('id')
    .eq('shop_id', shopId)
    .eq('therapist_id', therapistId)
    .eq('date', date)
    .limit(1)

  if (!shifts || shifts.length === 0) return 0

  // per_shift の手当を合算
  const { data: rules } = await supabase
    .from('deduction_rules')
    .select('*')
    .eq('shop_id', shopId)
    .eq('calc_timing', 'per_shift')
    .eq('is_active', true)

  let total = 0
  if (rules) {
    for (const rule of rules as DeductionRule[]) {
      if (rule.category === 'allowance') {
        total += rule.amount
      } else if (rule.category === 'deduction' || rule.category === 'penalty') {
        total -= rule.amount
      }
    }
  }

  return total
}

// ============================================================
// Data fetchers
// ============================================================

async function fetchShopBackRule(shopId: string): Promise<ShopBackRule | null> {
  const { data } = await supabase
    .from('shop_back_rules')
    .select('*')
    .eq('shop_id', shopId)
    .limit(1)

  if (data && data.length > 0) {
    const row = data[0] as ShopBackRule
    // course_back_amount 列が設定されており _rate 側がデフォルト値(0)の場合、
    // 新スキーマ（ShopBackRulesTab）で保存されたレコードとみなして fixed に補正する
    if (
      row.course_back_amount != null &&
      row.course_back_amount > 0 &&
      row.course_calc_type === 'percentage' &&
      row.course_back_rate === 0
    ) {
      row.course_calc_type = 'fixed'
    }
    return row
  }

  // レコードが存在しない場合、デフォルト設定で自動作成する
  const defaults = {
    shop_id: shopId,
    course_calc_type: 'fixed' as const,
    course_back_rate: 0,
    course_back_amount: 0,
    option_calc_type: 'full_back' as const,
    option_back_rate: 100,
    option_back_amount: 0,
    nomination_calc_type: 'full_back' as const,
    nomination_back_rate: 100,
    nomination_back_amount: 0,
    rounding_method: 'floor' as const,
    business_day_cutoff: '06:00',
  }
  const { data: inserted } = await supabase
    .from('shop_back_rules')
    .insert([defaults])
    .select()
    .limit(1)
  return (inserted?.[0] as ShopBackRule) ?? (defaults as ShopBackRule)
}

async function fetchTherapistOverride(therapistId: string, courseId: string): Promise<TherapistBackOverride | null> {
  const { data: specific } = await supabase
    .from('therapist_back_overrides')
    .select('*')
    .eq('therapist_id', therapistId)
    .eq('course_id', courseId)
    .limit(1)

  if (specific && specific.length > 0) return specific[0] as TherapistBackOverride

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
