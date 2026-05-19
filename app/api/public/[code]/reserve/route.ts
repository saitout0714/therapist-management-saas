import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

interface ReserveBody {
  therapist_id: string
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
  if (!therapist_id || !date || !start_time || !end_time || !course_id || !payment_method) {
    return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 })
  }
  if (!customer?.name || !customer?.furigana || !customer?.phone || !customer?.email) {
    return NextResponse.json({ error: 'お客様情報の必須項目が不足しています' }, { status: 400 })
  }

  // 電話番号で既存顧客を検索（ハイフンあり/なし両方対応）
  let customerId: string
  let isNewCustomer = false
  const phoneNorm = customer.phone.replace(/[^0-9]/g, '')
  const phoneVariants = [...new Set([customer.phone, phoneNorm])]

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
  // 新規顧客 → free、既存顧客で同セラピストの予約履歴あり → confirmed_nomination、なし → nomination
  let designationType: string = 'free'
  if (!isNewCustomer) {
    const { data: priorReservations } = await supabase
      .from('reservations')
      .select('id')
      .eq('shop_id', shopId)
      .eq('customer_id', customerId)
      .eq('therapist_id', therapist_id)
      .limit(1)

    designationType = priorReservations && priorReservations.length > 0
      ? 'confirmed_nomination'
      : 'nomination'
  }

  // コース情報取得
  const { data: course } = await supabase
    .from('courses')
    .select('base_price, name')
    .eq('id', course_id)
    .single()

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
      total_price: course?.base_price || 0,
      discount_amount: 0,
      designation_type: designationType,
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
