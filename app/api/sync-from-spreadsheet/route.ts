import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

interface SyncPayload {
  token: string
  shopId: string
  dates: string[]
  shifts: {
    date: string
    therapist_name: string
    room_name: string
    start_time: string
    end_time: string
  }[]
  reservations: {
    date: string
    therapist_name: string
    customer_name: string
    phone_suffix?: string
    start_time: string
    end_time: string
    duration: number
    designation_type: 'free' | 'nomination' | 'first_nomination' | 'confirmed' | 'princess'
    notes: string
  }[]
}

interface CachedData {
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
function calculateBackInMemory(
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

export async function POST(req: NextRequest) {
  try {
    const body: SyncPayload = await req.json()
    const { token, shopId, dates, shifts, reservations } = body

    // 1. トークン認証
    const expectedToken = process.env.SYNC_API_TOKEN || 'yoyakl_sync_token_2026'
    if (token !== expectedToken) {
      return NextResponse.json({ error: '認証トークンが無効です' }, { status: 401 })
    }

    if (!shopId) {
      return NextResponse.json({ error: 'shopId が必要です' }, { status: 400 })
    }

    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json({ error: '対象日付 (dates) が指定されていません' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 2. 基本マスタデータの一括取得 (セラピスト、ルーム、コース)
    const [therapistsRes, roomsRes, coursesRes] = await Promise.all([
      supabase.from('therapists').select('id, name, rank_id, back_calc_type').eq('shop_id', shopId),
      supabase.from('rooms').select('id, name').eq('shop_id', shopId),
      supabase.from('courses').select('id, name, duration, base_price, back_amount').eq('shop_id', shopId).eq('is_active', true),
    ])

    if (therapistsRes.error || roomsRes.error || coursesRes.error) {
      throw new Error(`基本マスタデータの取得に失敗しました: ${therapistsRes.error?.message || roomsRes.error?.message || coursesRes.error?.message}`)
    }

    const therapists = therapistsRes.data || []
    const rooms = roomsRes.data || []
    const courses = coursesRes.data || []

    // 3. バック額のインメモリ計算用マスタデータの一括取得 (Pre-fetch)
    const therapistIds = Array.from(new Set(therapists.map(t => t.id)))
    
    const [
      designationTypesRes,
      shopBackRulesRes,
      systemSettingsRes,
      therapistPricingsRes,
      therapistBackOverridesRes,
      rankBackRulesRes,
      deductionRulesRes,
      courseBackAmountsRes
    ] = await Promise.all([
      supabase.from('designation_types').select('id, slug, default_fee, default_back_amount, is_store_paid_back').eq('shop_id', shopId),
      supabase.from('shop_back_rules').select('*').eq('shop_id', shopId).maybeSingle(),
      supabase.from('system_settings').select('*').eq('shop_id', shopId).maybeSingle(),
      therapistIds.length > 0
        ? supabase.from('therapist_pricing').select('*').in('therapist_id', therapistIds)
        : Promise.resolve({ data: [] }),
      therapistIds.length > 0
        ? supabase.from('therapist_back_overrides').select('*').in('therapist_id', therapistIds)
        : Promise.resolve({ data: [] }),
      supabase.from('rank_back_rules').select('*').eq('shop_id', shopId),
      supabase.from('deduction_rules').select('*').eq('shop_id', shopId).eq('is_active', true),
      supabase.from('course_back_amounts').select('*').eq('shop_id', shopId)
    ])

    const cache: CachedData = {
      shopBackRule: shopBackRulesRes.data || null,
      designationTypes: designationTypesRes.data || [],
      courseBackAmounts: courseBackAmountsRes.data || [],
      therapistBackOverrides: therapistBackOverridesRes.data || [],
      rankBackRules: rankBackRulesRes.data || [],
      deductionRules: deductionRulesRes.data || [],
      systemSettings: systemSettingsRes.data || null,
      therapistPricings: therapistPricingsRes.data || []
    }

    // セラピスト名マッピング (前方一致にも対応)
    const findTherapist = (name: string) => {
      const cleanName = name.trim()
      const exact = therapists.find(t => t.name.trim() === cleanName)
      if (exact) return exact
      const partial = therapists.find(t => t.name.includes(cleanName) || cleanName.includes(t.name))
      if (partial) return partial
      return null
    }

    // ルーム名マッピング (部分一致対応)
    const findRoom = (name: string) => {
      if (!name) return null
      const cleanName = name.trim()
      const exact = rooms.find(r => r.name.trim() === cleanName)
      if (exact) return exact.id
      const partial = rooms.find(r => r.name.includes(cleanName) || cleanName.includes(r.name))
      if (partial) return partial.id
      return null
    }

    // コース時間マッピング (分数 -> コース)
    const findCourse = (duration: number) => {
      const exact = courses.find(c => c.duration === duration)
      if (exact) return exact
      if (courses.length > 0) {
        return courses.reduce((prev, curr) => 
          Math.abs(curr.duration - duration) < Math.abs(prev.duration - duration) ? curr : prev
        )
      }
      return null
    }

    // 4. 顧客の一括取得と、存在しない顧客のバルクインサートによる高速化
    const customerNames = Array.from(new Set(reservations.map(r => r.customer_name.trim())))
    const { data: dbCustomers, error: custFetchError } = await supabase
      .from('customers')
      .select('id, name, phone')
      .eq('shop_id', shopId)
      .in('name', customerNames)

    if (custFetchError) {
      throw new Error(`既存顧客データの取得に失敗しました: ${custFetchError.message}`)
    }

    const customerMap = new Map<string, string>() // key (name_phoneSuffix) -> customerId

    const findDbCustomer = (name: string, phoneSuffix?: string) => {
      const cleanName = name.trim()
      const matched = dbCustomers?.filter(c => c.name.trim() === cleanName) || []
      if (matched.length === 0) return null
      if (phoneSuffix) {
        const found = matched.find(c => c.phone && c.phone.replace(/[^0-9]/g, '').endsWith(phoneSuffix))
        if (found) return found.id
      }
      return matched[0].id
    }

    const uniqueCustomerKeys = Array.from(new Set(reservations.map(r => `${r.customer_name.trim()}_${r.phone_suffix || ''}`)))
    const customersToInsert = []

    for (const key of uniqueCustomerKeys) {
      const [name, phoneSuffix] = key.split('_')
      const dbId = findDbCustomer(name, phoneSuffix)
      if (dbId) {
        customerMap.set(key, dbId)
      } else {
        const phoneVal = phoneSuffix ? `0000000${phoneSuffix}` : null
        customersToInsert.push({
          shop_id: shopId,
          name: name.trim(),
          phone: phoneVal,
          status: '予約可'
        })
      }
    }

    if (customersToInsert.length > 0) {
      const { data: insertedCusts, error: insertCustError } = await supabase
        .from('customers')
        .insert(customersToInsert)
        .select('id, name, phone')

      if (insertCustError) {
        throw new Error(`新規顧客の一括作成に失敗しました: ${insertCustError.message}`)
      }

      if (insertedCusts) {
        for (const c of insertedCusts) {
          const phoneSuffix = c.phone ? c.phone.slice(-4) : ''
          const key = `${c.name.trim()}_${phoneSuffix}`
          customerMap.set(key, c.id)
        }
      }
    }

    // 5. 既存の該当期間・店舗の shifts と reservations を一括取得
    const [existingShiftsRes, existingReservationsRes] = await Promise.all([
      supabase
        .from('shifts')
        .select('id, therapist_id, date, room_id')
        .eq('shop_id', shopId)
        .in('date', dates),
      supabase
        .from('reservations')
        .select('id, therapist_id, date, start_time, room_id, customer_id, customers(name)')
        .eq('shop_id', shopId)
        .in('date', dates)
    ])

    if (existingShiftsRes.error || existingReservationsRes.error) {
      throw new Error(`既存データの確認に失敗しました: ${existingShiftsRes.error?.message || existingReservationsRes.error?.message}`)
    }

    const existingShifts = existingShiftsRes.data || []
    const existingReservations = existingReservationsRes.data || []

    // 6. 出勤情報 (shifts) の同期振り分け
    const shiftRowsToInsert = []
    const shiftsToUpdateRoom: { id: string; room_id: string }[] = []
    const therapistShiftRoomMap = new Map<string, string>() // therapistId_date -> roomId

    for (const s of shifts) {
      const therapist = findTherapist(s.therapist_name)
      if (!therapist) {
        console.warn(`[SpreadsheetSync] Therapist not found for shift: ${s.therapist_name}`)
        continue
      }
      const roomId = findRoom(s.room_name)

      const formatTime = (t: string) => {
        const parts = t.split(':')
        const h = String(parseInt(parts[0], 10)).padStart(2, '0')
        const m = String(parseInt(parts[1] || '0', 10)).padStart(2, '0')
        return `${h}:${m}:00`
      }

      // 既存シフトの検索
      const matchShift = existingShifts.find(es => es.therapist_id === therapist.id && es.date === s.date)

      if (matchShift) {
        // すでに存在する場合: room_idが空で、スプレッドシート側にあるならアップデート対象
        if (!matchShift.room_id && roomId) {
          shiftsToUpdateRoom.push({ id: matchShift.id, room_id: roomId })
        }
        // マップには既存のroom_id、またはスプレッドシートのroomIdを優先記録
        const effectiveRoomId = matchShift.room_id || roomId
        if (effectiveRoomId) {
          therapistShiftRoomMap.set(`${therapist.id}_${s.date}`, effectiveRoomId)
        }
      } else {
        // 新規登録対象
        shiftRowsToInsert.push({
          shop_id: shopId,
          therapist_id: therapist.id,
          room_id: roomId || null,
          date: s.date,
          start_time: formatTime(s.start_time),
          end_time: formatTime(s.end_time)
        })
        if (roomId) {
          therapistShiftRoomMap.set(`${therapist.id}_${s.date}`, roomId)
        }
      }
    }

    // シフトのバルク処理
    let insertedShiftsCount = shiftRowsToInsert.length
    if (shiftRowsToInsert.length > 0) {
      const { error } = await supabase.from('shifts').insert(shiftRowsToInsert)
      if (error) throw new Error(`新規出勤の登録に失敗しました: ${error.message}`)
    }
    for (const up of shiftsToUpdateRoom) {
      const { error } = await supabase.from('shifts').update({ room_id: up.room_id }).eq('id', up.id)
      if (error) {
        console.error(`[SpreadsheetSync] Failed to update room_id for shift: ${up.id}`, error)
      }
    }

    // 7. 予約情報 (reservations) の同期振り分け
    const reservationRowsToInsert = []
    const reservationsToUpdateRoom: { id: string; room_id: string }[] = []

    for (const r of reservations) {
      const therapist = findTherapist(r.therapist_name)
      if (!therapist) {
        console.warn(`[SpreadsheetSync] Therapist not found for reservation: ${r.therapist_name}`)
        continue
      }

      const cacheKey = `${r.customer_name.trim()}_${r.phone_suffix || ''}`
      const customerId = customerMap.get(cacheKey)
      if (!customerId) {
        console.warn(`[SpreadsheetSync] Customer resolved failed for reservation: ${r.customer_name}`)
        continue
      }

      const reservationRoomId = therapistShiftRoomMap.get(`${therapist.id}_${r.date}`) || null

      // 既存予約の検索 (セラピスト、日付、開始時刻、顧客名が一致するもの)
      const matchRes = existingReservations.find(er => {
        let erCustomerName = null
        if (er.customers) {
          if (Array.isArray(er.customers)) {
            erCustomerName = er.customers[0]?.name || null
          } else {
            erCustomerName = (er.customers as any).name || null
          }
        }

        const dbStart = er.start_time ? er.start_time.substring(0, 5) : ''
        const rStart = r.start_time ? r.start_time.substring(0, 5) : ''
        const timeMatch = dbStart === rStart
        
        const therapistMatch = er.therapist_id === therapist.id
        const dateMatch = er.date === r.date
        const customerMatch = erCustomerName && 
          erCustomerName.trim().toLowerCase() === r.customer_name.trim().toLowerCase()

        return timeMatch && therapistMatch && dateMatch && customerMatch
      })

      if (matchRes) {
        // すでに存在する場合: room_idが空で、引き当てたルームIDがあるならアップデート対象
        if (!matchRes.room_id && reservationRoomId) {
          reservationsToUpdateRoom.push({ id: matchRes.id, room_id: reservationRoomId })
        }
      } else {
        // 新規登録対象 (金額・バック計算を含む既存ロジック)
        const course = findCourse(r.duration)
        const courseId = course?.id || null
        const coursePrice = course?.base_price || 0
        const courseBackAmount = course?.back_amount || 0
        const courseDuration = course?.duration || r.duration

        const designationType = r.designation_type || 'free'
        const dtRow = cache.designationTypes.find(dt => dt.slug === designationType)
        const designationTypeId = dtRow?.id || null

        const backResult = calculateBackInMemory({
          shopId,
          therapistId: therapist.id,
          therapistRankId: therapist.rank_id || null,
          therapistBackCalcType: therapist.back_calc_type as any,
          courseId: courseId || '',
          coursePrice: coursePrice,
          courseDuration: courseDuration,
          designationType,
          date: r.date,
          startTime: r.start_time,
          courseBackAmount: courseBackAmount
        }, cache)

        let basePrice = backResult.resolvedCustomerPrice
        let nominationFee = 0

        if (designationType !== 'free' && !dtRow?.is_store_paid_back) {
          if (backResult.resolvedCustomerPrice > coursePrice) {
            nominationFee = backResult.resolvedCustomerPrice - coursePrice
            basePrice = coursePrice
          } else {
            const therapistPricing = cache.therapistPricings.find(tp => tp.therapist_id === therapist.id)
            const systemSettings = cache.systemSettings

            const defaultNominationFee = systemSettings?.default_nomination_fee || 0
            const defaultConfirmedFee = systemSettings?.default_confirmed_nomination_fee || 0
            const defaultPrincessFee = systemSettings?.default_princess_reservation_fee || 0
            
            const resolveFee = (therapistFee: number | null | undefined, defaultFee: number) =>
              therapistFee !== null && therapistFee !== undefined && therapistFee > 0 ? therapistFee : defaultFee

            if (designationType === 'first_nomination' || designationType === 'nomination') {
              nominationFee = resolveFee(therapistPricing?.nomination_fee, defaultNominationFee)
            } else if (designationType === 'confirmed') {
              nominationFee = resolveFee(therapistPricing?.confirmed_nomination_fee, defaultConfirmedFee)
            } else if (designationType === 'princess') {
              nominationFee = resolveFee(therapistPricing?.princess_reservation_fee, defaultPrincessFee)
            }
          }
        }

        const formatTime = (t: string) => {
          const parts = t.split(':')
          const h = String(parseInt(parts[0], 10)).padStart(2, '0')
          const m = String(parseInt(parts[1] || '0', 10)).padStart(2, '0')
          return `${h}:${m}:00`
        }

        reservationRowsToInsert.push({
          shop_id: shopId,
          therapist_id: therapist.id,
          room_id: reservationRoomId,
          customer_id: customerId,
          date: r.date,
          start_time: formatTime(r.start_time),
          end_time: formatTime(r.end_time),
          course_id: courseId,
          status: 'confirmed',
          payment_method: 'cash',
          options_payment_method: 'cash',
          extension_payment_method: 'cash',
          source: 'staff',
          is_handled: true,
          base_price: basePrice,
          nomination_fee: nominationFee,
          total_price: basePrice + nominationFee,
          discount_amount: 0,
          designation_type: designationType,
          designation_type_id: designationTypeId,
          therapist_back_amount: backResult.netBack,
          shop_revenue: backResult.shopRevenue,
          back_calculated_at: new Date().toISOString(),
          business_date: backResult.businessDate,
          notes: r.notes || 'スプレッドシート同期'
        })
      }
    }

    // 予約のバルク処理
    let insertedReservationsCount = reservationRowsToInsert.length
    if (reservationRowsToInsert.length > 0) {
      const { error } = await supabase.from('reservations').insert(reservationRowsToInsert)
      if (error) throw new Error(`新規予約の登録に失敗しました: ${error.message}`)
    }
    for (const up of reservationsToUpdateRoom) {
      const { error } = await supabase.from('reservations').update({ room_id: up.room_id }).eq('id', up.id)
      if (error) {
        console.error(`[SpreadsheetSync] Failed to update room_id for reservation: ${up.id}`, error)
      }
    }

    return NextResponse.json({
      success: true,
      shifts_count: insertedShiftsCount,
      reservations_count: insertedReservationsCount
    })

  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    console.error('[SpreadsheetSyncError]', e)
    return NextResponse.json({ error: `サーバーエラー: ${msg}` }, { status: 500 })
  }
}
