import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveCustomerPrice, calculateBack } from '@/lib/calculateBack'

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

    // 2. マスタデータの取得 (セラピスト、ルーム、コース、既存顧客)
    const [therapistsRes, roomsRes, coursesRes, customersRes] = await Promise.all([
      supabase.from('therapists').select('id, name, rank_id, back_calc_type').eq('shop_id', shopId),
      supabase.from('rooms').select('id, name').eq('shop_id', shopId),
      supabase.from('courses').select('id, name, duration, base_price, back_amount').eq('shop_id', shopId).eq('is_active', true),
      supabase.from('customers').select('id, name, phone').eq('shop_id', shopId)
    ])

    if (therapistsRes.error || roomsRes.error || coursesRes.error || customersRes.error) {
      throw new Error(`マスタデータの取得に失敗しました: ${therapistsRes.error?.message || roomsRes.error?.message || coursesRes.error?.message || customersRes.error?.message}`)
    }

    const therapists = therapistsRes.data || []
    const rooms = roomsRes.data || []
    const courses = coursesRes.data || []
    const customers = customersRes.data || []

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

    // 顧客の特定 (名前 + 電話番号下4桁)
    const findCustomer = (name: string, phoneSuffix?: string) => {
      const cleanName = name.trim()
      const matchedByName = customers.filter(c => c.name.trim() === cleanName)
      if (matchedByName.length === 0) return null

      if (phoneSuffix) {
        const matchedByPhone = matchedByName.find(c => c.phone && c.phone.replace(/[^0-9]/g, '').endsWith(phoneSuffix))
        if (matchedByPhone) return matchedByPhone.id
      }
      
      return matchedByName[0].id
    }

    // 3. 既存の該当期間・店舗の shifts と reservations を一括削除
    const { error: delResError } = await supabase
      .from('reservations')
      .delete()
      .eq('shop_id', shopId)
      .in('date', dates)

    if (delResError) {
      throw new Error(`既存予約データのクリーンアップに失敗しました: ${delResError.message}`)
    }

    const { error: delShiftsError } = await supabase
      .from('shifts')
      .delete()
      .eq('shop_id', shopId)
      .in('date', dates)

    if (delShiftsError) {
      throw new Error(`既存出勤データのクリーンアップに失敗しました: ${delShiftsError.message}`)
    }

    // 4. 出勤情報 (shifts) のインサート
    const shiftRows = []
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

      shiftRows.push({
        shop_id: shopId,
        therapist_id: therapist.id,
        room_id: roomId || null,
        date: s.date,
        start_time: formatTime(s.start_time),
        end_time: formatTime(s.end_time)
      })
    }

    let insertedShiftsCount = 0
    if (shiftRows.length > 0) {
      const { data: insShifts, error: insShiftsError } = await supabase
        .from('shifts')
        .insert(shiftRows)
        .select('id')

      if (insShiftsError) {
        throw new Error(`出勤情報のインサートに失敗しました: ${insShiftsError.message}`)
      }
      insertedShiftsCount = insShifts?.length || 0
    }

    // 5. 予約情報 (reservations) のインサート
    const reservationRows = []
    const newCustomersCache = new Map<string, string>()

    for (const r of reservations) {
      const therapist = findTherapist(r.therapist_name)
      if (!therapist) {
        console.warn(`[SpreadsheetSync] Therapist not found for reservation: ${r.therapist_name}`)
        continue
      }

      const cleanCustomerName = r.customer_name.trim()
      let customerId = findCustomer(cleanCustomerName, r.phone_suffix)

      if (!customerId) {
        const cacheKey = `${cleanCustomerName}_${r.phone_suffix || ''}`
        if (newCustomersCache.has(cacheKey)) {
          customerId = newCustomersCache.get(cacheKey)!
        } else {
          const phoneVal = r.phone_suffix ? `0000000${r.phone_suffix}` : null
          const { data: newCust, error: custError } = await supabase
            .from('customers')
            .insert({
              shop_id: shopId,
              name: cleanCustomerName,
              phone: phoneVal,
              status: '予約可'
            })
            .select('id')
            .single()

          if (custError || !newCust) {
            console.error(`[SpreadsheetSync] Failed to create customer: ${cleanCustomerName}`, custError?.message)
            continue
          }
          customerId = newCust.id
          newCustomersCache.set(cacheKey, customerId)
        }
      }

      const course = findCourse(r.duration)
      const courseId = course?.id || null
      const coursePrice = course?.base_price || 0
      const courseBackAmount = course?.back_amount || 0
      const courseDuration = course?.duration || r.duration

      const designationType = r.designation_type || 'free'
      let designationTypeId = null
      
      const { data: dtRow } = await supabase
        .from('designation_types')
        .select('id, default_fee, is_store_paid_back')
        .eq('shop_id', shopId)
        .eq('slug', designationType)
        .maybeSingle()

      if (dtRow) {
        designationTypeId = dtRow.id
      }

      let resolvedPrice = { customerPrice: coursePrice }
      try {
        resolvedPrice = await resolveCustomerPrice(
          shopId,
          courseId || '',
          therapist.rank_id || null,
          designationType,
          coursePrice,
          supabase
        )
      } catch (err) {
        console.warn(`[SpreadsheetSync] resolveCustomerPrice failed, using course base price:`, err)
      }

      let basePrice = resolvedPrice.customerPrice
      let nominationFee = 0

      if (designationType !== 'free' && !dtRow?.is_store_paid_back) {
        if (resolvedPrice.customerPrice > coursePrice) {
          nominationFee = resolvedPrice.customerPrice - coursePrice
          basePrice = coursePrice
        } else {
          const [settingsRes, pricingRes] = await Promise.all([
            supabase.from('system_settings').select('default_nomination_fee, default_confirmed_nomination_fee, default_princess_reservation_fee').eq('shop_id', shopId).maybeSingle(),
            supabase.from('therapist_pricing').select('nomination_fee, confirmed_nomination_fee, princess_reservation_fee').eq('therapist_id', therapist.id).maybeSingle()
          ])

          const systemSettings = settingsRes.data
          const therapistPricing = pricingRes.data

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

      let therapistBackAmount = 0
      let shopRevenue = 0
      let businessDate = r.date

      try {
        const backResult = await calculateBack({
          shopId,
          therapistId: therapist.id,
          therapistRankId: therapist.rank_id || null,
          therapistBackCalcType: therapist.back_calc_type || null,
          courseId: courseId || '',
          coursePrice: coursePrice,
          courseBackAmount: courseBackAmount,
          courseDuration: courseDuration,
          designationType,
          nominationFee,
          options: [],
          discounts: [],
          date: r.date,
          startTime: r.start_time,
          supabaseClient: supabase
        })
        therapistBackAmount = backResult.netBack
        shopRevenue = backResult.shopRevenue
        businessDate = backResult.businessDate
      } catch (err) {
        console.error(`[SpreadsheetSync] calculateBack failed:`, err)
      }

      const formatTime = (t: string) => {
        const parts = t.split(':')
        const h = String(parseInt(parts[0], 10)).padStart(2, '0')
        const m = String(parseInt(parts[1] || '0', 10)).padStart(2, '0')
        return `${h}:${m}:00`
      }

      reservationRows.push({
        shop_id: shopId,
        therapist_id: therapist.id,
        customer_id: customerId,
        date: r.date,
        start_time: formatTime(r.start_time),
        end_time: formatTime(r.end_time),
        course_id: courseId,
        status: 'confirmed',
        payment_method: 'cash',
        options_payment_method: 'cash',
        extension_payment_method: 'cash',
        source: 'spreadsheet',
        is_handled: true,
        base_price: basePrice,
        nomination_fee: nominationFee,
        total_price: basePrice + nominationFee,
        discount_amount: 0,
        designation_type: designationType,
        designation_type_id: designationTypeId,
        therapist_back_amount: therapistBackAmount,
        shop_revenue: shopRevenue,
        back_calculated_at: new Date().toISOString(),
        business_date: businessDate,
        notes: r.notes || 'スプレッドシート同期'
      })
    }

    let insertedReservationsCount = 0
    if (reservationRows.length > 0) {
      const { data: insReservations, error: insReservationsError } = await supabase
        .from('reservations')
        .insert(reservationRows)
        .select('id')

      if (insReservationsError) {
        throw new Error(`予約情報のインサートに失敗しました: ${insReservationsError.message}`)
      }
      insertedReservationsCount = insReservations?.length || 0
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
