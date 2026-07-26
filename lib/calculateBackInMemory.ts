export interface CachedData {
  shopBackRule: any
  designationTypes: any[]
  courseBackAmounts: any[]
  therapistBackOverrides: any[]
  rankBackRules: any[]
  deductionRules: any[]
  systemSettings: any
  therapistPricings: any[]
}

// 高速インメモリ計算関数 (DBアクセスなし)
export function calculateBackInMemory(
  input: {
    shopId: string
    therapistId: string
    therapistRankId: string | null
    therapistBackCalcType: 'percentage' | 'fixed' | 'half_split' | null
    courseId: string
    coursePrice: number
    courseDuration: number
    designationType: string // slug
    date: string
    startTime: string
    courseBackAmount?: number
  },
  cache: CachedData
) {
  const shopRule = cache.shopBackRule || {
    course_calc_type: 'fixed',
    course_back_rate: 0,
    course_back_amount: 0,
    nomination_calc_type: 'full_back',
    nomination_back_rate: 100,
    rounding_method: 'floor',
    business_day_cutoff: '06:00'
  }

  // 1. 営業日の解決
  const resolveBusinessDate = (date: string, startTime: string, cutoff: string): string => {
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
  const businessDate = resolveBusinessDate(input.date, input.startTime, shopRule.business_day_cutoff)

  // 2. 顧客料金・バック額のマトリクス解決
  let effectiveCoursePrice = input.coursePrice
  let matrixBackAmount: number | null = null
  let source: 'matrix' | 'default' | 'fallback' = 'fallback'

  // A. マトリクス表 (course_back_amounts)
  if (input.therapistRankId) {
    const row = cache.courseBackAmounts.find(
      cba => cba.course_id === input.courseId &&
             cba.rank_id === input.therapistRankId &&
             cba.designation_type === input.designationType
    )
    if (row) {
      effectiveCoursePrice = row.customer_price ?? row.course_price_override ?? input.coursePrice
      matrixBackAmount = row.back_amount
      source = 'matrix'
    }
  }

  // B. 指名種別デフォルト (designation_types)
  if (source === 'fallback') {
    const dt = cache.designationTypes.find(d => d.slug === input.designationType)
    if (dt) {
      effectiveCoursePrice = input.coursePrice + (dt.default_fee || 0)
      matrixBackAmount = dt.default_back_amount ?? null
      source = 'default'
    }
  }

  const matrixBackUsed = source === 'matrix' && matrixBackAmount !== null

  // 3. 指名料の分離
  const implicitNominationFee = (
    !matrixBackUsed &&
    source === 'default' &&
    effectiveCoursePrice > input.coursePrice
  ) ? effectiveCoursePrice - input.coursePrice : 0
  const courseOnlyPrice = effectiveCoursePrice - implicitNominationFee
  const nominationFeeForBack = implicitNominationFee

  // 4. バック率の解決 (resolveBackRates)
  let calcType = shopRule.course_calc_type
  let courseRate = Number(shopRule.course_back_rate)
  let nominationRate: number | null = null

  if (input.therapistBackCalcType === 'half_split') {
    calcType = 'half_split'
    const override = cache.therapistBackOverrides.find(o => o.therapist_id === input.therapistId && o.course_id === input.courseId) ||
                     cache.therapistBackOverrides.find(o => o.therapist_id === input.therapistId && o.course_id === null)
    courseRate = override?.course_back_rate ?? 50
  } else {
    // セラピスト個別オーバーライド
    const override = cache.therapistBackOverrides.find(o => o.therapist_id === input.therapistId && o.course_id === input.courseId) ||
                     cache.therapistBackOverrides.find(o => o.therapist_id === input.therapistId && o.course_id === null)
    if (override && override.course_back_rate !== null) {
      calcType = 'percentage'
      courseRate = override.course_back_rate
      nominationRate = override.nomination_back_rate
    } else if (input.therapistRankId) {
      // ランク別
      const rankRule = cache.rankBackRules.find(r => r.rank_id === input.therapistRankId)
      if (rankRule && rankRule.course_back_rate !== null) {
        courseRate = rankRule.course_back_rate
      }
    }
  }

  // 5. 端数処理
  const applyRounding = (val: number, method: string): number => {
    switch (method) {
      case 'floor': return Math.floor(val)
      case 'ceil': return Math.ceil(val)
      case 'round': return Math.round(val)
      default: return Math.floor(val)
    }
  }

  let courseBack = 0
  let nominationBack = 0
  let calcMethod = ''

  if (calcType === 'half_split') {
    // 折半
    const halfSplitNominationBack = (implicitNominationFee > 0 && matrixBackAmount !== null)
      ? matrixBackAmount
      : nominationFeeForBack
    const courseHalfBack = (input.courseBackAmount && input.courseBackAmount > 0)
      ? input.courseBackAmount
      : applyRounding((courseOnlyPrice - 0) * courseRate / 100, shopRule.rounding_method)
    const totalBack = courseHalfBack + halfSplitNominationBack

    // 控除
    let deductions = 0
    let allowances = 0
    cache.deductionRules.forEach(rule => {
      if (rule.calc_timing === 'per_reservation' && input.courseDuration >= rule.min_duration) {
        if (rule.category === 'deduction' || rule.category === 'penalty') deductions += rule.amount
        else if (rule.category === 'allowance') allowances += rule.amount
      }
    })

    const totalPrice = courseOnlyPrice + nominationFeeForBack
    return {
      courseBack: courseHalfBack,
      nominationBack: halfSplitNominationBack,
      totalBack,
      deductions,
      allowances,
      netBack: totalBack - deductions + allowances,
      shopRevenue: totalPrice - totalBack,
      totalPrice,
      resolvedCustomerPrice: effectiveCoursePrice,
      businessDate,
      calcMethod: `総売上折半方式（${courseRate}%）`
    }
  }

  // 通常計算 (percentage or fixed)
  if (matrixBackUsed) {
    courseBack = matrixBackAmount!
    calcMethod = `固定額（詳細設定: ¥${courseBack.toLocaleString()}）`
  } else if (calcType === 'percentage') {
    if (input.courseBackAmount && input.courseBackAmount > 0) {
      courseBack = input.courseBackAmount
      calcMethod = `コース設定バック（¥${courseBack.toLocaleString()}）`
    } else {
      courseBack = applyRounding(courseOnlyPrice * courseRate / 100, shopRule.rounding_method)
      calcMethod = `パーセンテージ（${courseRate}%）`
    }
  } else if (calcType === 'fixed') {
    if (matrixBackAmount) {
      courseBack = matrixBackAmount
      calcMethod = `固定額（詳細設定: ¥${courseBack.toLocaleString()}）`
    } else if (input.courseBackAmount && input.courseBackAmount > 0) {
      courseBack = input.courseBackAmount
      calcMethod = `コース設定バック（¥${courseBack.toLocaleString()}）`
    } else {
      courseBack = 0
      calcMethod = '固定額（未設定 → 0円）'
    }
  }

  // 指名料バック
  if (nominationFeeForBack > 0) {
    if (implicitNominationFee > 0 && matrixBackAmount !== null) {
      nominationBack = matrixBackAmount
    } else {
      switch (shopRule.nomination_calc_type) {
        case 'full_back':
          nominationBack = nominationFeeForBack
          break
        case 'percentage':
          const nomRate = nominationRate ?? shopRule.nomination_back_rate
          nominationBack = applyRounding(nominationFeeForBack * nomRate / 100, shopRule.rounding_method)
          break
        default:
          nominationBack = nominationFeeForBack
      }
    }
  }

  if (matrixBackUsed) {
    courseBack = Math.max(0, courseBack - nominationBack)
  }

  const totalBack = courseBack + nominationBack

  // 控除
  let deductions = 0
  let allowances = 0
  cache.deductionRules.forEach(rule => {
    if (rule.calc_timing === 'per_reservation' && input.courseDuration >= rule.min_duration) {
      if (rule.category === 'deduction' || rule.category === 'penalty') deductions += rule.amount
      else if (rule.category === 'allowance') allowances += rule.amount
    }
  })

  const totalPrice = courseOnlyPrice + nominationFeeForBack
  const netBack = totalBack - deductions + allowances
  const shopRevenue = totalPrice - totalBack

  return {
    courseBack,
    nominationBack,
    totalBack,
    deductions,
    allowances,
    netBack: Math.max(0, netBack),
    shopRevenue: Math.max(0, shopRevenue),
    totalPrice,
    resolvedCustomerPrice: effectiveCoursePrice,
    businessDate,
    calcMethod
  }
}
