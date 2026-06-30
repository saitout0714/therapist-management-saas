import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

interface ParsedReservation {
  date: string;
  startTime: string;
  endTime: string;
  customerName: string;
  phone: string;
  email: string;
  therapistName: string;
  courseName: string;
  price: number;
  shopNameRaw: string;
}

// 深夜帯（00:00〜05:59）を 24:00〜29:59 に補正する終了時間計算ヘルパー
function calcEndTime(startTimeStr: string, durationMinutes: number): string {
  const [hStr, mStr] = startTimeStr.split(':')
  let h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  
  let totalMinutes = h * 60 + m + durationMinutes
  let newH = Math.floor(totalMinutes / 60)
  let newM = totalMinutes % 60
  
  if (newH >= 24) {
    // 24:00以上ならその表記のままにする
  } else if (newH >= 0 && newH < 6) {
    // 00:00 〜 05:59 は 24時間加算する
    newH += 24
  }
  
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:00`
}

function formatTimeToDb(t: string): string {
  const parts = t.split(':')
  const h = String(parseInt(parts[0], 10)).padStart(2, '0')
  const m = String(parseInt(parts[1] || '0', 10)).padStart(2, '0')
  return `${h}:${m}:00`
}

// 媒体の自動判別
function determineSourceType(subject: string, body: string): 'esthe_damashii' | 'grow' | 'esthe_ranking' | 'fallback' {
  const combined = `${subject}\n${body}`
  if (combined.includes('エステ魂')) {
    return 'esthe_damashii'
  }
  if (combined.includes('Grow') || combined.includes('grow')) {
    return 'grow'
  }
  if (combined.includes('メンズエステランキング') || combined.includes('esthe-ranking')) {
    return 'esthe_ranking'
  }
  return 'fallback'
}

// A. エステ魂パーサー
function parseEstheDamashii(body: string): ParsedReservation {
  const name = body.match(/■お名前：\s*([^\n\r]+)/)?.[1]?.trim() || ''
  const email = body.match(/■メールアドレス：\s*([^\n\r]+)/)?.[1]?.trim() || ''
  const phone = body.match(/■電話番号：\s*([^\n\r]+)/)?.[1]?.trim() || ''
  
  const dateTimeStr = body.match(/■ご希望日時：\s*([^\n\r]+)/)?.[1]?.trim() || ''
  let date = ''
  let startTime = ''
  let endTime = ''
  
  const dtMatch = dateTimeStr.match(/(\d+)\/(\d+)\s*\([^)]+\)\s*(\d+):(\d+)/)
  if (dtMatch) {
    const month = dtMatch[1].padStart(2, '0')
    const day = dtMatch[2].padStart(2, '0')
    const year = new Date().getFullYear() // 2026年
    date = `${year}-${month}-${day}`
    startTime = `${dtMatch[3].padStart(2, '0')}:${dtMatch[4].padStart(2, '0')}`
  }
  
  const therapistName = body.match(/■ご希望セラピスト：\s*([^\n\r]+)/)?.[1]?.trim() || ''
  const courseName = body.match(/■ご希望コース：\s*([^\n\r]+)/)?.[1]?.trim() || ''
  
  let duration = 60
  const durMatch = courseName.match(/(\d+)分/)
  if (durMatch) {
    duration = parseInt(durMatch[1], 10)
  }
  
  if (startTime) {
    endTime = calcEndTime(startTime, duration)
    startTime = formatTimeToDb(startTime)
  }
  
  const priceStr = body.match(/合計金額：\s*([\d,]+)円/)?.[1] || '0'
  const price = parseInt(priceStr.replace(/,/g, ''), 10)
  
  const shopNameRaw = body.match(/お店番号：\d+\]\s*([^\n\r]+様)/)?.[1]?.replace(/様$/, '')?.trim() || ''

  return { date, startTime, endTime, customerName: name, phone, email, therapistName, courseName, price, shopNameRaw }
}

// B. growパーサー
function parseGrow(body: string): ParsedReservation {
  const shopNameRaw = body.match(/店舗：\s*([^\n\r]+)/)?.[1]?.trim() || ''
  
  const dateTimeStr = body.match(/予約日時：\s*([^\n\r]+)/)?.[1]?.trim() || ''
  let date = ''
  let startTime = ''
  let endTime = ''
  
  const dtMatch = dateTimeStr.match(/(\d{4})年(\d{2})月(\d{2})日\([^)]+\)(\d{2}):(\d{2})/)
  if (dtMatch) {
    date = `${dtMatch[1]}-${dtMatch[2]}-${dtMatch[3]}`
    startTime = `${dtMatch[4]}:${dtMatch[5]}`
  }
  
  const therapistLine = body.match(/担当セラピスト：\s*([^\n\r]+)/)?.[1]?.trim() || ''
  const therapistName = therapistLine.split(/[\s(（]/)[0] || ''
  
  const courseName = body.match(/メニュー：\s*([^\n\r]+)/)?.[1]?.trim() || ''
  
  let duration = 60
  const durMatch = courseName.match(/(\d+)(?:min|分)/i)
  if (durMatch) {
    duration = parseInt(durMatch[1], 10)
  }
  
  if (startTime) {
    endTime = calcEndTime(startTime, duration)
    startTime = formatTimeToDb(startTime)
  }
  
  const name = body.match(/お客様名：\s*([^\n\r]+)/)?.[1]?.trim() || ''
  const phone = body.match(/電話番号：\s*([^\n\r]+)/)?.[1]?.trim() || ''
  const email = body.match(/メールアドレス：\s*([^\n\r]+)/)?.[1]?.trim() || ''
  
  // 料金：0円 もしくはメニューから抽出
  const priceStr = courseName.match(/([\d,]+)\s*yen/i)?.[1] || '0'
  const price = parseInt(priceStr.replace(/,/g, ''), 10)
  
  return { date, startTime, endTime, customerName: name, phone, email, therapistName, courseName, price, shopNameRaw }
}

// C. 全国メンズエステランキングパーサー
function parseEstheRanking(body: string): ParsedReservation {
  const getValueAfterKey = (key: string): string => {
    const regex = new RegExp(`${key}\\s*\\n\\s*([^\\n\\r]+)`)
    return body.match(regex)?.[1]?.trim() || ''
  }
  
  const nameRaw = getValueAfterKey('【お名前】')
  const customerName = nameRaw.replace(/\s*様$/, '').trim()
  const email = getValueAfterKey('【メールアドレス】')
  const phone = getValueAfterKey('【電話番号】')
  const shopNameRaw = getValueAfterKey('【店名】')
  const therapistName = getValueAfterKey('【ご希望セラピスト】')
  
  const dateTimeStr = getValueAfterKey('【ご予約日時】')
  let date = ''
  let startTime = ''
  let endTime = ''
  
  const dtMatch = dateTimeStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s*（[^)]+）\s*(\d{2}):(\d{2})/)
  if (dtMatch) {
    const month = dtMatch[2].padStart(2, '0')
    const day = dtMatch[3].padStart(2, '0')
    date = `${dtMatch[1]}-${month}-${day}`
    startTime = `${dtMatch[4].padStart(2, '0')}:${dtMatch[5].padStart(2, '0')}`
  }
  
  const courseMatch = body.match(/【ご希望コース】\s*\n\s*([\s\S]*?)(?=\n\n|\n-|$)/)
  const courseName = courseMatch?.[1]?.trim() || ''
  
  let duration = 60
  const durMatch = courseName.match(/(\d+)\s*分/)
  if (durMatch) {
    duration = parseInt(durMatch[1], 10)
  }
  
  if (startTime) {
    endTime = calcEndTime(startTime, duration)
    startTime = formatTimeToDb(startTime)
  }
  
  const priceStr = body.match(/合計：\s*([\d,]+)円/)?.[1] || '0'
  const price = parseInt(priceStr.replace(/,/g, ''), 10)
  
  return { date, startTime, endTime, customerName, phone, email, therapistName, courseName, price, shopNameRaw }
}

// D. フォールバックパーサー
function parseFallback(body: string): ParsedReservation {
  const customerName = body.match(/(?:お名前|お客様名|氏名)[：:]\s*([^\n\r]+)/)?.[1]?.replace(/\s*様$/, '')?.trim() || ''
  const phone = body.match(/(?:電話番号|TEL)[：:]\s*([\d-]+)/)?.[1]?.trim() || ''
  const email = body.match(/(?:メールアドレス|E-mail|メール)[：:]\s*([^\n\r]+)/)?.[1]?.trim() || ''
  const therapistName = body.match(/(?:セラピスト|担当|指名)[：:]\s*([^\n\r]+)/)?.[1]?.trim() || ''
  const courseName = body.match(/(?:コース|メニュー)[：:]\s*([^\n\r]+)/)?.[1]?.trim() || ''
  
  let date = ''
  let startTime = ''
  let endTime = ''
  const dateMatch = body.match(/(?:日時|希望日時|予約日時)[：:]\s*([^\n\r]+)/)
  if (dateMatch) {
    const dtStr = dateMatch[1]
    const dtMatch1 = dtStr.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/)
    if (dtMatch1) {
      const y = dtMatch1[1]
      const m = dtMatch1[2].padStart(2, '0')
      const d = dtMatch1[3].padStart(2, '0')
      date = `${y}-${m}-${d}`
    } else {
      const dtMatch2 = dtStr.match(/(\d{1,2})[-/月](\d{1,2})/)
      if (dtMatch2) {
        const y = new Date().getFullYear()
        const m = dtMatch2[1].padStart(2, '0')
        const d = dtMatch2[2].padStart(2, '0')
        date = `${y}-${m}-${d}`
      }
    }
    const timeMatch = dtStr.match(/(\d{2}):(\d{2})/)
    if (timeMatch) {
      startTime = `${timeMatch[1]}:${timeMatch[2]}`
    }
  }
  
  let duration = 60
  const durMatch = courseName.match(/(\d+)/)
  if (durMatch) {
    duration = parseInt(durMatch[1], 10)
  }
  
  if (startTime) {
    endTime = calcEndTime(startTime, duration)
    startTime = formatTimeToDb(startTime)
  }
  
  return { date, startTime, endTime, customerName, phone, email, therapistName, courseName, price: 0, shopNameRaw: '' }
}

export async function POST(req: NextRequest) {
  try {
    // 認証
    const authHeader = req.headers.get('X-Yoyakl-API-Key')
    const expectedApiKey = process.env.MAIL_SYNC_API_KEY || 'test-key'
    if (!authHeader || authHeader !== expectedApiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { subject, body: rawBody, shop_id: defaultShopId } = await req.json()
    if (!rawBody) {
      return NextResponse.json({ error: '本文 (body) は必須です' }, { status: 400 })
    }

    // 改行コードの統一
    const body = rawBody.replace(/\r\n/g, '\n')

    // 媒体判定とパース
    const sourceType = determineSourceType(subject || '', body)
    console.log(`[MailSync] Detected source type: ${sourceType}`)

    let parsed: ParsedReservation
    switch (sourceType) {
      case 'esthe_damashii':
        parsed = parseEstheDamashii(body)
        break
      case 'grow':
        parsed = parseGrow(body)
        break
      case 'esthe_ranking':
        parsed = parseEstheRanking(body)
        break
      default:
        parsed = parseFallback(body)
        break
    }

    console.log('[MailSync] Parsed data:', parsed)

    if (!parsed.date || !parsed.startTime) {
      console.log('[MailSync] Could not parse date/time. Treating as non-reservation mail. Skipping silently.')
      return NextResponse.json({
        success: true,
        skipped: true,
        message: '予約メールではないため、登録および通知をスキップしました。',
        parsedData: parsed
      })
    }

    // 1. 店舗の特定
    let shopId = defaultShopId || null
    if (parsed.shopNameRaw) {
      const { data: shops } = await supabaseAdmin
        .from('shops')
        .select('id, name, short_name')
        .eq('is_active', true)
      
      if (shops) {
        const rawLower = parsed.shopNameRaw.toLowerCase()
        const matched = shops.find(s => {
          const name = s.name.toLowerCase()
          const shortName = (s.short_name || '').toLowerCase()
          return rawLower.includes(name) || (shortName && rawLower.includes(shortName)) || name.includes(rawLower)
        })
        if (matched) {
          shopId = matched.id
          console.log(`[MailSync] Matched shop: ${matched.name} (${shopId})`)
        }
      }
    }

    if (!shopId) {
      return NextResponse.json({
        error: '店舗 (shop_id) を特定できませんでした。デフォルトの店舗IDを指定するか、正しい店名が含まれるメールを送信してください。',
        parsedData: parsed
      }, { status: 422 })
    }

    // 2. セラピストの特定
    let therapistId = null
    if (parsed.therapistName) {
      const { data: therapists } = await supabaseAdmin
        .from('therapists')
        .select('id, name')
        .eq('shop_id', shopId)
        .eq('is_active', true)
      
      if (therapists) {
        const matched = therapists.find(t => 
          t.name.toLowerCase().includes(parsed.therapistName.toLowerCase()) ||
          parsed.therapistName.toLowerCase().includes(t.name.toLowerCase())
        )
        if (matched) {
          therapistId = matched.id
          console.log(`[MailSync] Matched therapist: ${matched.name} (${therapistId})`)
        }
      }
    }

    // 3. コースの特定
    let courseId = null
    let basePrice = parsed.price
    if (parsed.courseName) {
      const { data: courses } = await supabaseAdmin
        .from('courses')
        .select('id, name, base_price')
        .eq('shop_id', shopId)
        .eq('is_active', true)
      
      if (courses) {
        const matched = courses.find(c => 
          c.name.toLowerCase().includes(parsed.courseName.toLowerCase()) ||
          parsed.courseName.toLowerCase().includes(c.name.toLowerCase())
        )
        if (matched) {
          courseId = matched.id
          if (basePrice === 0) {
            basePrice = matched.base_price
          }
          console.log(`[MailSync] Matched course: ${matched.name} (${courseId})`)
        }
      }
    }

    // 4. 顧客の特定または作成
    let customerId = null
    if (parsed.customerName) {
      let existingCustomer = null
      
      if (parsed.phone || parsed.email) {
        let query = supabaseAdmin.from('customers').select('id').eq('shop_id', shopId)
        
        if (parsed.phone && parsed.email) {
          const { data } = await query.or(`phone.eq.${parsed.phone},email.eq.${parsed.email}`).maybeSingle()
          existingCustomer = data
        } else if (parsed.phone) {
          const { data } = await query.eq('phone', parsed.phone).maybeSingle()
          existingCustomer = data
        } else if (parsed.email) {
          const { data } = await query.eq('email', parsed.email).maybeSingle()
          existingCustomer = data
        }
      }
      
      if (existingCustomer) {
        customerId = existingCustomer.id
        console.log(`[MailSync] Matched existing customer: ${customerId}`)
      } else {
        // 新規作成
        const { data: newCust, error: custErr } = await supabaseAdmin
          .from('customers')
          .insert({
            name: parsed.customerName,
            phone: parsed.phone || null,
            email: parsed.email || null,
            shop_id: shopId,
            status: '予約可',
            memo: 'メール同期により自動作成'
          })
          .select('id')
          .single()
        
        if (custErr) {
          console.error('[MailSync] Failed to create customer:', custErr)
        } else if (newCust) {
          customerId = newCust.id
          console.log(`[MailSync] Created new customer: ${customerId}`)
        }
      }
    }

    // 5. 既存予約との重複（競合）検知
    let isConflict = false
    let conflictDetails = ''

    if (therapistId && shopId && parsed.date && parsed.startTime && parsed.endTime) {
      const { data: existingRes } = await supabaseAdmin
        .from('reservations')
        .select('id, start_time, end_time, customer:customers(name)')
        .eq('shop_id', shopId)
        .eq('therapist_id', therapistId)
        .eq('date', parsed.date)
        .eq('status', 'confirmed')

      if (existingRes && existingRes.length > 0) {
        const newStart = parsed.startTime
        const newEnd = parsed.endTime

        for (const res of existingRes) {
          const resStart = res.start_time
          const resEnd = res.end_time

          // 重複条件: newStart < resEnd && newEnd > resStart
          if (newStart < resEnd && newEnd > resStart) {
            isConflict = true
            const custName = (res.customer as any)?.name || '不明'
            conflictDetails = `既存の確定予約（${resStart.slice(0, 5)}〜${resEnd.slice(0, 5)}: ${custName}様）と時間帯が重複しています。`
            break
          }
        }
      }
    }

    // growからのメールは即時確定(confirmed)、その他は仮予約(pending)
    const isGrow = sourceType === 'grow'
    const status = isGrow ? 'confirmed' : 'pending'
    const isHandled = isGrow ? true : false

    let warningNotes = ''
    if (isConflict) {
      warningNotes = `【⚠️警告: 予約重複（ダブルブッキング）の可能性あり】\n${conflictDetails}\nこの時間は既にセラピストの確定予約が入っています。お客様への連絡と時間調整の交渉を行ってください。\n\n`
    }

    // 6. 予約の挿入
    const reservationData = {
      shop_id: shopId,
      therapist_id: therapistId,
      customer_id: customerId,
      course_id: courseId,
      date: parsed.date,
      start_time: parsed.startTime,
      end_time: parsed.endTime,
      status: status,
      source: 'web',
      is_handled: isHandled,
      base_price: basePrice,
      total_price: basePrice,
      notes: `${warningNotes}【メール同期自動登録】\n媒体: ${sourceType}\n元のメール本文:\n${body}`
    }

    const { data: reservation, error: resErr } = await supabaseAdmin
      .from('reservations')
      .insert([reservationData])
      .select('*')
      .single()

    if (resErr) {
      console.error('[MailSync] Failed to create reservation:', resErr)
      return NextResponse.json({ error: `予約の登録に失敗しました: ${resErr.message}` }, { status: 500 })
    }

    console.log('[MailSync] Successfully created reservation:', reservation)

    return NextResponse.json({
      success: true,
      reservation
    })

  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    console.error('[MailSync] Server Error:', e)
    return NextResponse.json({ error: `サーバーエラー: ${msg}` }, { status: 500 })
  }
}
