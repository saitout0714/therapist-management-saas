import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveCustomerPrice, calculateBack } from '@/lib/calculateBack'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

interface ReserveBody {
  therapist_id: string | null
  date: string
  start_time: string
  end_time: string
  course_id: string
  payment_method: 'cash' | 'credit'
  customer: {
    name: string
    furigana: string
    phone: string
    email: string
    notes?: string
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const supabase = getServiceClient()

  // コードから店舗を確認
  const { data: codeRow, error: codeError } = await supabase
    .from('shop_reservation_codes')
    .select('shop_id, is_active')
    .eq('code', code)
    .single()

  if (codeError || !codeRow || !codeRow.is_active) {
    return NextResponse.json({ error: '無効な予約ページです' }, { status: 404 })
  }

  const shopId = codeRow.shop_id
  let body: ReserveBody

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'リクエスト形式が正しくありません' }, { status: 400 })
  }

  const { therapist_id, date, start_time, end_time, course_id, payment_method, customer } = body

  // バリデーション
  if (!date || !start_time || !end_time || !course_id || !payment_method) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }
  if (!customer?.name || !customer?.furigana || !customer?.phone || !customer?.email) {
    return NextResponse.json({ error: 'お客様情報の必須項目が不足しています' }, { status: 400 })
  }

  // 電話番号で既存顧客を検索（ハイフンあり/なし/全角など全パターン対応）
  let customerId: string
  let isNewCustomer = false
  const phoneNorm = customer.phone.replace(/[^0-9]/g, '') // 数字のみ
  // ハイフンあり形式を生成（例: 09012345678 → 090-1234-5678）
  let phoneHyphen = phoneNorm
  if (/^0[789]0\d{8}$/.test(phoneNorm)) {
    phoneHyphen = `${phoneNorm.slice(0, 3)}-${phoneNorm.slice(3, 7)}-${phoneNorm.slice(7)}`
  } else if (/^0\d{9}$/.test(phoneNorm)) {
    phoneHyphen = `${phoneNorm.slice(0, 2)}-${phoneNorm.slice(2, 6)}-${phoneNorm.slice(6)}`
  }
  const phoneVariants = [...new Set([customer.phone, phoneNorm, phoneHyphen])]

  let existingCustomer: { id: string } | null = null
  for (const phone of phoneVariants) {
    const { data } = await supabase
      .from('customers')
      .select('id')
      .eq('shop_id', shopId)
      .eq('phone', phone)
      .maybeSingle()
    if (data) { existingCustomer = data as { id: string }; break }
  }

  if (existingCustomer) {
    customerId = existingCustomer.id
    // フリガナ・メールを更新（未設定の場合のみ）
    await supabase
      .from('customers')
      .update({ furigana: customer.furigana, email: customer.email })
      .eq('id', customerId)
      .is('furigana', null)
  } else {
    // 新規顧客作成（電話番号は数字のみに正規化して保存）
    const { data: newCustomer, error: customerError } = await supabase
      .from('customers')
      .insert({
        shop_id: shopId,
        name: customer.name,
        furigana: customer.furigana,
        phone: phoneNorm,
        email: customer.email,
        status: '予約可',
      })
      .select('id')
      .single()

    if (customerError || !newCustomer) {
      return NextResponse.json({ error: '顧客情報の登録に失敗しました' }, { status: 500 })
    }
    customerId = newCustomer.id
    isNewCustomer = true
  }

  // 指名区分の自動判定
  // therapist_id なし（フリー選択）→ free
  // therapist_id あり + 既存顧客 + 同セラピスト履歴あり → confirmed（本指名）
  // therapist_id あり + それ以外 → nomination（初回指名）
  let designationType: string
  if (!therapist_id) {
    designationType = 'free'
  } else if (isNewCustomer) {
    designationType = 'nomination'
  } else {
    const { data: priorReservations } = await supabase
      .from('reservations')
      .select('id')
      .eq('shop_id', shopId)
      .eq('customer_id', customerId)
      .eq('therapist_id', therapist_id)
      .limit(1)

    designationType = priorReservations && priorReservations.length > 0
      ? 'confirmed'
      : 'nomination'
  }

  // コース情報取得
  const { data: course } = await supabase
    .from('courses')
    .select('base_price, name, back_amount, duration')
    .eq('id', course_id)
    .single()

  // 1. セラピスト設定の取得
  let therapist = null
  if (therapist_id) {
    const { data: ther } = await supabase
      .from('therapists')
      .select('rank_id, back_calc_type')
      .eq('id', therapist_id)
      .maybeSingle()
    therapist = ther
  }

  // 2. 指名区分のIDと設定行の取得
  let designationTypeRow = null
  let designationTypeId: string | null = null
  if (designationType) {
    const { data: dtRow } = await supabase
      .from('designation_types')
      .select('id, slug, is_store_paid_back, default_fee')
      .eq('shop_id', shopId)
      .eq('slug', designationType)
      .maybeSingle()
    if (dtRow) {
      designationTypeRow = dtRow
      designationTypeId = dtRow.id
    }
  }

  // 3. 顧客料金と指名料の解決
  const resolvedPrice = await resolveCustomerPrice(
    shopId,
    course_id,
    therapist?.rank_id || null,
    designationType,
    course?.base_price || 0,
    supabase
  )

  let basePrice = resolvedPrice.customerPrice
  let nominationFee = 0

  if (designationType !== 'free' && !designationTypeRow?.is_store_paid_back) {
    if (resolvedPrice.customerPrice > (course?.base_price || 0)) {
      // コース料金自体が matrix やデフォルト設定によって高くなっている場合、
      // 指名料はすでにその customerPrice に内包されているため、追加の nominationFee は 0 とする
      nominationFee = 0
    } else {
      // フォールバック: system_settings や therapist_pricing から取得
      const { data: systemSettings } = await supabase
        .from('system_settings')
        .select('default_nomination_fee, default_confirmed_nomination_fee, default_princess_reservation_fee')
        .eq('shop_id', shopId)
        .maybeSingle()

      let therapistPricing = null
      if (therapist_id) {
        const { data: pricing } = await supabase
          .from('therapist_pricing')
          .select('nomination_fee, confirmed_nomination_fee, princess_reservation_fee')
          .eq('therapist_id', therapist_id)
          .maybeSingle()
        therapistPricing = pricing
      }

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

  // 4. セラピストバック額の算出
  let therapistBackAmount = 0
  let shopRevenue = 0
  let businessDate = date
  if (therapist_id) {
    try {
      const backInput = {
        shopId,
        therapistId: therapist_id,
        therapistRankId: therapist?.rank_id || null,
        therapistBackCalcType: therapist?.back_calc_type || null,
        courseId: course_id,
        coursePrice: course?.base_price || 0,
        courseBackAmount: course?.back_amount || 0,
        courseDuration: course?.duration || 0,
        designationType,
        nominationFee,
        options: [],
        discounts: [],
        date,
        startTime: start_time,
        supabaseClient: supabase
      }
      const backResult = await calculateBack(backInput)
      therapistBackAmount = backResult.netBack
      shopRevenue = backResult.shopRevenue
      businessDate = backResult.businessDate
    } catch (err) {
      console.error('バック金額の自動計算に失敗:', err)
    }
  }

  // 予約作成
  const { data: reservation, error: reservationError } = await supabase
    .from('reservations')
    .insert({
      shop_id: shopId,
      therapist_id,
      customer_id: customerId,
      date,
      start_time,
      end_time,
      course_id,
      status: 'confirmed',
      payment_method,
      source: 'web',
      is_handled: false,
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
      notes: customer.notes || null,
    })
    .select('id')
    .single()

  if (reservationError || !reservation) {
    return NextResponse.json({ error: '予約の登録に失敗しました: ' + reservationError?.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    reservation_id: reservation.id,
    message: 'ご予約を受け付けました。店舗より確認のご連絡をお送りします。',
  })
}
