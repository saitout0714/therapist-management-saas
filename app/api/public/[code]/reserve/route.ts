import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveCustomerPrice, calculateBack } from '@/lib/calculateBack'
import nodemailer from 'nodemailer'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

type SmtpSettings = {
  smtp_host?: string | null
  smtp_port?: number | null
  smtp_secure?: boolean | null
  smtp_user?: string | null
  smtp_pass?: string | null
  smtp_from?: string | null
}

function getMailTransporter(smtpSettings?: SmtpSettings | null) {
  // データベース側でSMTPサーバー（ホスト）が登録されていない場合は、
  // 環境変数（.env.local）の設定をすべてそのまま使用して送信する（データベースのデフォルト値による上書きを防ぐ）
  if (!smtpSettings?.smtp_host) {
    const host = process.env.SMTP_HOST || 'smtp.example.com'
    const port = parseInt(process.env.SMTP_PORT || '587', 10)
    const secure = process.env.SMTP_SECURE === 'true'
    const user = process.env.SMTP_USER || 'test@example.com'
    const pass = process.env.SMTP_PASS || 'password'

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    })
  }

  const host = smtpSettings.smtp_host
  
  let port = parseInt(process.env.SMTP_PORT || '587', 10)
  if (smtpSettings.smtp_port !== undefined && smtpSettings.smtp_port !== null) {
    port = smtpSettings.smtp_port
  }

  let secure = process.env.SMTP_SECURE === 'true'
  if (smtpSettings.smtp_secure !== undefined && smtpSettings.smtp_secure !== null) {
    secure = smtpSettings.smtp_secure
  }

  const user = smtpSettings.smtp_user || process.env.SMTP_USER || 'test@example.com'
  const pass = smtpSettings.smtp_pass || process.env.SMTP_PASS || 'password'

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  })
}

async function sendConfirmationEmail({
  email,
  customerName,
  date,
  startTime,
  endTime,
  courseName,
  courseDuration,
  therapistName,
  totalPrice,
  basePrice,
  nominationFee,
  paymentMethod,
  room,
  isNewCustomer,
  shopAddressMode,
  webReserveAddressMode,
  smtpSettings,
  shopName,
  hpUrl,
  phone,
}: {
  email: string
  customerName: string
  date: string
  startTime: string
  endTime: string
  courseName: string
  courseDuration: number
  therapistName: string
  totalPrice: number
  basePrice: number
  nominationFee: number
  paymentMethod: string
  room: any | null
  isNewCustomer: boolean
  shopAddressMode: string
  webReserveAddressMode: string
  smtpSettings?: SmtpSettings | null
  shopName: string
  hpUrl?: string | null
  phone?: string | null
}) {
  try {
    const transporter = getMailTransporter(smtpSettings)
    
    // 送信元（From）の生成
    // 優先順位: 1. 店舗の個別 From 設定, 2. 環境変数の SMTP_FROM, 3. デフォルト noreply
    let from = smtpSettings?.smtp_from || process.env.SMTP_FROM || '"予約完了通知" <noreply@example.com>'
    
    // 共通サーバーを使う（店舗個別 From がない、または環境変数の SMTP_FROM を使う）場合に、店舗名を動的に差し込む
    if (!smtpSettings?.smtp_from && shopName) {
      const emailMatch = from.match(/<([^>]+)>/)
      const emailAddress = emailMatch ? emailMatch[1] : (from.includes('@') ? from.trim() : 'noreply@example.com')
      from = `"${shopName} 予約確認" <${emailAddress}>`
    }

    // 返信不可アドレスの抽出（Reply-To用）
    const fromEmailMatch = from.match(/<([^>]+)>/)
    const replyToAddress = fromEmailMatch ? fromEmailMatch[1] : (from.includes('@') ? from.trim() : 'noreply@example.com')

    // ルーム・案内文の出し分けロジック
    let template = ''
    let additionalNote = ''
    const commonNote = room?.sms_note_common || ''

    if (room) {
      // WEB予約住所送信モードが「新規／会員で切替」かつ「新規顧客」の場合のみ新規様用テンプレートを使用
      if (webReserveAddressMode === 'split_by_membership' && isNewCustomer) {
        // 新規顧客向け
        // WEB予約メール自動返信用の新規様向けテンプレがあればそれを使用。なければデフォルト案内文を表示
        template = room.template_web_new_customer || `※※ ご新規様へ重要なお知らせ ※※
防犯上の都合により、マンションの詳しい住所や部屋番号はメールには記載しておりません。
この後、店舗よりお客様の携帯電話番号へSMS（ショートメッセージ）にて詳細な道案内をお送りいたします。
そちらのSMSをご確認いただき、ご返信をいただいた時点でご予約確定とさせていただきます。`
        
        additionalNote = room.sms_note_new_customer || ''
      } else {
        // 会員顧客向け（または一律送信の場合）
        template = room.template_web_member || ''
        additionalNote = room.sms_note_member || ''
      }
    }

    const paymentLabel = paymentMethod === 'credit' ? 'クレジットカード決済' : '現地決済（現金）'

    let bodyText = `【ご予約完了】ご予約ありがとうございます。

※※ 重要 ※※
本メールは送信専用アドレスから自動送信されています。
このメールに直接返信することはできません。お問い合わせ等がある場合は、お手数ですが店舗までお電話または公式LINEなどより直接ご連絡いただきますようお願いいたします。

この度はご予約いただき誠にありがとうございます。
ご予約内容が確定いたしましたので、詳細をご案内いたします。

■ ご予約内容
・日時：${date} ${startTime.slice(0, 5)} ～ ${endTime.slice(0, 5)}
・コース：${courseName} (${courseDuration}分)
・担当セラピスト：${therapistName}

■ お支払い金額
・合計金額：¥${totalPrice.toLocaleString()} (税込)
  (内訳: 基本料金 ¥${basePrice.toLocaleString()} / 指名料 ¥${nominationFee.toLocaleString()})
・お支払い方法：${paymentLabel}

■ ルームの場所・ご案内
`

    if (commonNote) {
      bodyText += `${commonNote}\n\n`
    }

    bodyText += `・お部屋：${room?.name || '未定（ご来店時にご案内します）'}\n`

    if (template) {
      bodyText += `\n${template}\n`
    }

    if (additionalNote) {
      bodyText += `\n${additionalNote}\n`
    }

    let footerText = `
------------------------
※このメールは送信専用アドレス（noreply）のため、直接ご返信いただくことはできません。
※ご予約の変更・キャンセルは、お早めに店舗までご連絡ください。
皆様のご来店を心よりお待ちしております。`

    if (shopName) {
      footerText += `\n\n【店舗情報】\n・店舗名：${shopName}`
      if (phone) {
        footerText += `\n・電話番号：${phone}`
      }
      if (hpUrl) {
        footerText += `\n・ウェブサイト：${hpUrl}`
      }
    }

    bodyText += footerText

    const mailOptions = {
      from,
      to: email,
      replyTo: replyToAddress,
      subject: `【ご予約完了】ご予約ありがとうございます`,
      text: bodyText,
    }

    await transporter.sendMail(mailOptions)
    console.log(`[Email Sent] Confirmation successfully sent to ${email}`)
  } catch (error) {
    console.error('[Email Error] Failed to send confirmation email:', error)
  }
}

async function sendRejectionEmail({
  email,
  customerName,
  shopName,
  phone,
  hpUrl,
  smtpSettings,
}: {
  email: string
  customerName: string
  shopName: string
  phone?: string | null
  hpUrl?: string | null
  smtpSettings?: SmtpSettings | null
}) {
  try {
    const transporter = getMailTransporter(smtpSettings)
    
    let from = smtpSettings?.smtp_from || process.env.SMTP_FROM || '"店舗案内" <noreply@example.com>'
    if (!smtpSettings?.smtp_from && shopName) {
      const emailMatch = from.match(/<([^>]+)>/)
      const emailAddress = emailMatch ? emailMatch[1] : (from.includes('@') ? from.trim() : 'noreply@example.com')
      from = `"${shopName}" <${emailAddress}>`
    }

    const fromEmailMatch = from.match(/<([^>]+)>/)
    const replyToAddress = fromEmailMatch ? fromEmailMatch[1] : (from.includes('@') ? from.trim() : 'noreply@example.com')

    let bodyText = `${customerName} 様
    
この度はご予約のお申し込みをいただきありがとうございます。

大変恐れ入りますが、当店は現在、WEB予約が初めてのお客様からの自動受付を制限させていただいております。

WEB予約を完了することができませんでしたので、ご新規でのご予約をご希望の場合、または【お電話番号が変わられたお客様】は、大変お手数ですが直接店舗までお電話または公式LINEよりお問い合わせいただきますようお願い申し上げます。
`

    let footerText = `
------------------------
※このメールは送信専用アドレス（noreply）のため、直接ご返信いただくことはできません。`

    if (shopName) {
      footerText += `\n\n【店舗情報】\n・店舗名：${shopName}`
      if (phone) {
        footerText += `\n・電話番号：${phone}`
      }
      if (hpUrl) {
        footerText += `\n・ウェブサイト：${hpUrl}`
      }
    }

    bodyText += footerText

    const mailOptions = {
      from,
      to: email,
      replyTo: replyToAddress,
      subject: `【重要】WEB予約の受付についてのご案内`,
      text: bodyText,
    }

    await transporter.sendMail(mailOptions)
    console.log(`[Rejection Email Sent] Sent to ${email}`)
  } catch (error) {
    console.error('[Rejection Email Error] Failed to send email:', error)
  }
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

  // 新規予約受付設定を取得
  const { data: systemSettings } = await supabase
    .from('system_settings')
    .select('allow_new_customers')
    .eq('shop_id', shopId)
    .maybeSingle()
  const allowNewCustomers = systemSettings?.allow_new_customers ?? true

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
    // 新規予約制限のチェック
    if (!allowNewCustomers) {
      // メールアドレスが入力されている場合、お断りメールを自動送信
      if (customer.email) {
        try {
          const [shopRes, settingsRes] = await Promise.all([
            supabase.from('shops').select('name, phone').eq('id', shopId).maybeSingle(),
            supabase
              .from('system_settings')
              .select('smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from, hp_url')
              .eq('shop_id', shopId)
              .maybeSingle()
          ])

          const shopName = shopRes.data?.name || ''
          const shopPhone = shopRes.data?.phone || null
          const smtpSettings = settingsRes.data
          const hpUrl = settingsRes.data?.hp_url || null

          await sendRejectionEmail({
            email: customer.email,
            customerName: customer.name,
            shopName,
            phone: shopPhone,
            hpUrl,
            smtpSettings,
          })
        } catch (emailErr) {
          console.error('[Rejection Email Error] Failed to send rejection email:', emailErr)
        }
      }

      return NextResponse.json(
        { error: '現在、新規のお客様のWEB予約は受け付けておりません。お手数ですが、お電話または公式LINEなどからお問い合わせください。' },
        { status: 400 }
      )
    }

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

  // NGセラピストチェック
  if (!isNewCustomer && therapist_id) {
    const { data: ngData, error: ngError } = await supabase
      .from('customer_therapist_ng')
      .select('id')
      .eq('customer_id', customerId)
      .eq('therapist_id', therapist_id)
      .maybeSingle()

    if (ngError) {
      console.error('NGチェックエラー:', ngError)
    } else if (ngData) {
      return NextResponse.json(
        { error: 'ご指定のセラピストでのご予約は承ることができません。別のセラピストを選択するか、指名なしでご予約ください。' },
        { status: 400 }
      )
    }
  }

  // 指名区分の自動判定
  // therapist_id なし（フリー選択）→ free
  // therapist_id あり + 既存顧客 + 同セラピスト履歴あり → confirmed（本指名）
  // therapist_id あり + それ以外 → first_nomination（初回指名）
  let designationType: string
  if (!therapist_id) {
    designationType = 'free'
  } else if (isNewCustomer) {
    designationType = 'first_nomination'
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
      : 'first_nomination'
  }

  // コース情報取得
  const { data: course } = await supabase
    .from('courses')
    .select('base_price, name, back_amount, duration')
    .eq('id', course_id)
    .single()

  // 1. セラピスト設定の取得
  let therapist = null
  let therapistName = 'フリー（指名なし）'
  if (therapist_id) {
    const { data: ther } = await supabase
      .from('therapists')
      .select('name, rank_id, back_calc_type')
      .eq('id', therapist_id)
      .maybeSingle()
    therapist = ther
    if (ther?.name) {
      therapistName = ther.name
    }
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
    const originalBase = course?.base_price || 0
    if (resolvedPrice.customerPrice > originalBase) {
      // コース料金自体が matrix やデフォルト設定によって高くなっている場合、
      // 指名料はすでにその customerPrice に内包されているため、差し引いて分離する
      nominationFee = resolvedPrice.customerPrice - originalBase
      basePrice = originalBase
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

  // 予約作成成功後、メール配信用データの追加フェッチと送信処理
  try {
    // 1. 店舗の送信モードと個別SMTP設定を並行取得
    const [shopRes, settingsRes] = await Promise.all([
      supabase.from('shops').select('name, sms_address_mode, web_reserve_address_mode, phone').eq('id', shopId).maybeSingle(),
      supabase
        .from('system_settings')
        .select('smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, smtp_from, hp_url')
        .eq('shop_id', shopId)
        .maybeSingle()
    ])

    const shopAddressMode = shopRes.data?.sms_address_mode || 'unified'
    const webReserveAddressMode = shopRes.data?.web_reserve_address_mode || 'unified'
    const shopName = shopRes.data?.name || ''
    const shopPhone = shopRes.data?.phone || null
    const smtpSettings = settingsRes.data
    const hpUrl = settingsRes.data?.hp_url || null

    // 2. ルーム情報を取得
    let roomInfo = null
    if (therapist_id) {
      const { data: shiftRow } = await supabase
        .from('shifts')
        .select(`
          room_id,
          rooms (
            id,
            name,
            address,
            google_map_url,
            address_nearby,
            google_map_url_nearby,
            template_new_customer,
            template_member,
            template_web_member,
            template_web_new_customer,
            sms_note_common,
            sms_note_new_customer,
            sms_note_member
          )
        `)
        .eq('shop_id', shopId)
        .eq('therapist_id', therapist_id)
        .eq('date', date)
        .maybeSingle()

      if (shiftRow?.rooms) {
        roomInfo = Array.isArray(shiftRow.rooms) ? shiftRow.rooms[0] : shiftRow.rooms
      }
    }

    // 3. メール送信を実行 (サーバーレス環境でプロセスが終了するのを防ぐため、送信完了を待機する)
    if (customer.email) {
      await sendConfirmationEmail({
        email: customer.email,
        customerName: customer.name,
        date,
        startTime: start_time,
        endTime: end_time,
        courseName: course?.name || '選択コース',
        courseDuration: course?.duration || 0,
        therapistName,
        totalPrice: basePrice + nominationFee,
        basePrice,
        nominationFee,
        paymentMethod: payment_method,
        room: roomInfo,
        isNewCustomer,
        shopAddressMode,
        webReserveAddressMode,
        smtpSettings,
        shopName,
        hpUrl,
        phone: shopPhone,
      })
    }
  } catch (emailFetchErr) {
    console.error('[Email Info Fetch Error] Failed to fetch context for email dispatch:', emailFetchErr)
  }

  // Googleカレンダー同期APIの呼び出し
  try {
    const protocol = req.headers.get('x-forwarded-proto') || 'http'
    const host = req.headers.get('host')
    const syncUrl = `${protocol}://${host}/api/calendar-sync`
    
    await fetch(syncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId: reservation.id,
        action: 'create'
      })
    })
  } catch (syncErr) {
    console.error('[CalendarSync] Web予約時のカレンダー同期呼び出しに失敗しました:', syncErr)
  }

  return NextResponse.json({
    success: true,
    reservation_id: reservation.id,
    message: 'ご予約を受け付けました。店舗より確認のご連絡をお送りします。',
  })
}
