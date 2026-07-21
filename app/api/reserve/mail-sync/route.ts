import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendAdminReservationNotification } from '@/lib/notifications'

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
  designationRaw?: string;
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

function getDesignationSlug(text: string): string {
  const cleanText = text.trim()
  if (cleanText.includes('本指名') || cleanText.includes('本指') || cleanText === '指名') {
    return 'confirmed'
  }
  if (cleanText.includes('初回指名') || cleanText.includes('初回')) {
    return 'first_nomination'
  }
  if (cleanText.includes('フリー') || cleanText.includes('指名なし') || cleanText.includes('なし')) {
    return 'free'
  }
  return 'free' // デフォルトはフリー
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
  const name = body.match(/■お名前：[ \t]*([^\n\r]*)/)?.[1]?.trim() || ''
  const email = body.match(/■メールアドレス：[ \t]*([^\n\r]*)/)?.[1]?.trim() || ''
  const phone = body.match(/■電話番号：[ \t]*([^\n\r]*)/)?.[1]?.trim() || ''
  
  const dateTimeStr = body.match(/■ご希望日時：[ \t]*([^\n\r]*)/)?.[1]?.trim() || ''
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
  
  const therapistName = body.match(/■ご希望セラピスト：[ \t]*([^\n\r]*)/)?.[1]?.trim() || ''
  const courseName = body.match(/■ご希望コース：[ \t]*([^\n\r]*)/)?.[1]?.trim() || ''
  
  let duration = 60
  const durMatch = courseName.match(/(\d+)分/)
  if (durMatch) {
    duration = parseInt(durMatch[1], 10)
  }
  
  if (startTime) {
    endTime = calcEndTime(startTime, duration)
    startTime = formatTimeToDb(startTime)
  }
  
  const priceStr = body.match(/合計金額：[ \t]*([\d,]+)円/)?.[1] || '0'
  const price = parseInt(priceStr.replace(/,/g, ''), 10)
  
  const shopNameRaw = body.match(/お店番号：\d+\][ \t]*([^\n\r]*様)/)?.[1]?.replace(/様$/, '')?.trim() || ''

  const designationRaw = body.match(/(?:指名|指名区分|■ご希望指名区分|■指名)[：:]\s*([^\n\r]+)/)?.[1]?.trim() || ''

  return { date, startTime, endTime, customerName: name, phone, email, therapistName, courseName, price, shopNameRaw, designationRaw }
}

// B. growパーサー
function parseGrow(body: string): ParsedReservation {
  const shopNameRaw = body.match(/店舗：[ \t]*([^\n\r]*)/)?.[1]?.trim() || ''
  
  const dateTimeStr = body.match(/予約日時：[ \t]*([^\n\r]*)/)?.[1]?.trim() || ''
  let date = ''
  let startTime = ''
  let endTime = ''
  
  const dtMatch = dateTimeStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\([^)]+\)(\d{1,2}):(\d{2})/)
  if (dtMatch) {
    const month = dtMatch[2].padStart(2, '0')
    const day = dtMatch[3].padStart(2, '0')
    const hour = dtMatch[4].padStart(2, '0')
    date = `${dtMatch[1]}-${month}-${day}`
    startTime = `${hour}:${dtMatch[5]}`
  }
  
  const therapistLine = body.match(/担当セラピスト：[ \t]*([^\n\r]*)/)?.[1]?.trim() || ''
  const therapistName = therapistLine.split(/[(（]/)[0].trim()
  
  const courseName = body.match(/メニュー：[ \t]*([^\n\r]*)/)?.[1]?.trim() || ''
  
  let duration = 60
  const durMatch = courseName.match(/(\d+)(?:min|分)/i)
  if (durMatch) {
    duration = parseInt(durMatch[1], 10)
  }
  
  if (startTime) {
    endTime = calcEndTime(startTime, duration)
    startTime = formatTimeToDb(startTime)
  }
  
  const name = body.match(/お客様名：[ \t]*([^\n\r]*)/)?.[1]?.trim() || ''
  const phone = body.match(/電話番号：[ \t]*([^\n\r]*)/)?.[1]?.trim() || ''
  const email = body.match(/メールアドレス：[ \t]*([^\n\r]*)/)?.[1]?.trim() || ''
  
  // 料金：0円 もしくはメニューから抽出
  const priceStr = courseName.match(/([\d,]+)\s*yen/i)?.[1] || '0'
  const price = parseInt(priceStr.replace(/,/g, ''), 10)
  
  const designationRaw = body.match(/(?:指名|指名区分)[：:]\s*([^\n\r]+)/)?.[1]?.trim() || ''

  return { date, startTime, endTime, customerName: name, phone, email, therapistName, courseName, price, shopNameRaw, designationRaw }
}

// C. 全国メンズエステランキングパーサー
function parseEstheRanking(body: string): ParsedReservation {
  const getValueAfterKey = (key: string): string => {
    const lines = body.split(/\r?\n/)
    const keyIndex = lines.findIndex(l => l.includes(key))
    if (keyIndex !== -1 && keyIndex + 1 < lines.length) {
      const nextLine = lines[keyIndex + 1].trim()
      if (nextLine === '' || nextLine.startsWith('【')) {
        return ''
      }
      return nextLine
    }
    return ''
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
  
  const designationRaw = getValueAfterKey('【指名区分】') || getValueAfterKey('【指名】') || body.match(/(?:指名|指名区分)[：:]\s*([^\n\r]+)/)?.[1]?.trim() || ''

  return { date, startTime, endTime, customerName, phone, email, therapistName, courseName, price, shopNameRaw, designationRaw }
}

// D. フォールバックパーサー
function parseFallback(body: string): ParsedReservation {
  const customerName = body.match(/(?:お名前|お客様名|氏名)[：:]\s*([^\n\r]+)/)?.[1]?.replace(/\s*様$/, '')?.trim() || ''
  const phone = body.match(/(?:電話番号|TEL)[：:]\s*([\d-]+)/)?.[1]?.trim() || ''
  const email = body.match(/(?:メールアドレス|E-mail|メール)[：:]\s*([^\n\r]+)/)?.[1]?.trim() || ''
  const therapistName = body.match(/(?:セラピスト|担当|指名)[：:]\s*([^\n\r]+)/)?.[1]?.trim() || ''
  const courseName = body.match(/(?:コース|メニュー)[：:]\s*([^\n\r]+)/)?.[1]?.trim() || ''
  const shopNameRaw = body.match(/(?:店舗|店名|お店|サロン)[：:]\s*([^\n\r]+)/)?.[1]?.trim() || ''
  
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
  
  const designationRaw = body.match(/(?:指名|指名区分|選考|区分)[：:]\s*([^\n\r]+)/)?.[1]?.trim() || ''

  return { date, startTime, endTime, customerName, phone, email, therapistName, courseName, price: 0, shopNameRaw, designationRaw }
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

    // 深夜時間帯 (00:00 〜 05:59) の予約を、前日の営業日（例: 24:40等）へ自動補正する
    if (parsed.date && parsed.startTime) {
      const [hStr, mStr] = parsed.startTime.split(':')
      const h = parseInt(hStr, 10)
      if (h >= 0 && h < 6) {
        const dateObj = new Date(parsed.date)
        dateObj.setDate(dateObj.getDate() - 1)
        const y = dateObj.getFullYear()
        const m = String(dateObj.getMonth() + 1).padStart(2, '0')
        const d = String(dateObj.getDate()).padStart(2, '0')
        
        parsed.date = `${y}-${m}-${d}`
        
        const newH = h + 24
        parsed.startTime = `${String(newH).padStart(2, '0')}:${mStr}:00`
        
        console.log(`[MailSync] Adjusted midnight reservation: date=${parsed.date}, startTime=${parsed.startTime}, endTime=${parsed.endTime}`)
      }
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
    // shopNameRaw が抽出できなかった場合は本文全体を検索対象にする
    const searchTarget = parsed.shopNameRaw || body

    if (searchTarget) {
      const rawLower = searchTarget.toLowerCase()
      
      // 特殊ルール：同じオーナーで同じメールを利用している「レジェンド」「タイガーリリー」「レジェンド目白」の振り分け
      if (rawLower.includes('目白')) {
        shopId = 'a628f5ad-3bda-442f-9cfe-c5c00c3e65c1' // レジェンド目白 の店舗ID
        console.log(`[MailSync] Custom matched shop: レジェンド目白 (${shopId})`)
      } else if (
        rawLower.includes('legend') || 
        rawLower.includes('レジェンド') || 
        rawLower.includes('三鷹') || 
        rawLower.includes('府中') || 
        rawLower.includes('ひばり')
      ) {
        shopId = '36949671-c90c-4cf9-9d88-51bd71a2b352' // レジェンド の店舗ID
        console.log(`[MailSync] Custom matched shop: レジェンド (${shopId})`)
      } else if (
        rawLower.includes('tiger') || 
        rawLower.includes('lily') || 
        rawLower.includes('タイガー') || 
        rawLower.includes('タイガ')
      ) {
        shopId = '4808aee9-9940-410c-aa5b-dd1364e2da2c' // タイガーリリー の店舗ID
        console.log(`[MailSync] Custom matched shop: タイガーリリー (${shopId})`)
      } else {
        // 通常の部分一致マッチング
        const { data: shops } = await supabaseAdmin
          .from('shops')
          .select('id, name, short_name')
          .eq('is_active', true)
        
        if (shops) {
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
        const matched = therapists.find(t => {
          const dbNameClean = t.name.replace(/\s+/g, '').toLowerCase()
          const parsedNameClean = parsed.therapistName.replace(/\s+/g, '').toLowerCase()
          return dbNameClean.includes(parsedNameClean) || parsedNameClean.includes(dbNameClean)
        })
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
        .select('id, name, base_price, duration')
        .eq('shop_id', shopId)
        .eq('is_active', true)
      
      if (courses) {
        let matched = courses.find(c => 
          c.name.toLowerCase().includes(parsed.courseName.toLowerCase()) ||
          parsed.courseName.toLowerCase().includes(c.name.toLowerCase())
        )
        
        // 部分一致しなかった場合、数字（分数）の抽出によるマッチングを試みる
        if (!matched) {
          const parsedMinutesMatch = parsed.courseName.match(/(\d+)\s*(?:min|分)/i)
          if (parsedMinutesMatch) {
            const parsedMinutes = parseInt(parsedMinutesMatch[1], 10)
            matched = courses.find(c => {
              const dbMinutesMatch = c.name.match(/(\d+)/)
              if (dbMinutesMatch) {
                const dbMinutes = parseInt(dbMinutesMatch[1], 10)
                return dbMinutes === parsedMinutes
              }
              return Math.abs(c.duration - parsedMinutes) <= 10
            })
          }
        }

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
    const isHandled = false // 全てのメール連携予約は未対応(通知未送信)として扱う

    let warningNotes = ''
    if (isConflict) {
      warningNotes = `【⚠️警告: 予約重複（ダブルブッキング）の可能性あり】\n${conflictDetails}\nこの時間は既にセラピストの確定予約が入っています。お客様への連絡と時間調整の交渉を行ってください。\n\n`
    }

    // 5.5. 指名区分の特定
    let designationTypeId = null
    let dbDesignationType = 'free'

    if (parsed.designationRaw) {
      dbDesignationType = getDesignationSlug(parsed.designationRaw)
    }

    if (shopId) {
      const { data: destTypes } = await supabaseAdmin
        .from('designation_types')
        .select('id, slug')
        .eq('shop_id', shopId)
        .eq('is_active', true)

      if (destTypes) {
        const matchedType = destTypes.find(dt => dt.slug === dbDesignationType)
        if (matchedType) {
          designationTypeId = matchedType.id
        }
      }
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
      booking_method: 'web',
      is_handled: isHandled,
      base_price: basePrice,
      total_price: basePrice,
      designation_type: dbDesignationType,
      designation_type_id: designationTypeId,
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

    // 管理者向け自動通知（メール・LINE）の送信
    if (shopId) {
      try {
        await sendAdminReservationNotification({
          reservationId: reservation.id,
          shopId: shopId,
          supabase: supabaseAdmin,
        })
      } catch (err) {
        console.error('[MailSync Admin Notification Error] Failed to trigger admin notification:', err)
      }
    }

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
