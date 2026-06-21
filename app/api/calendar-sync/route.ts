import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { 
      reservationId, 
      action, 
      deletedEventId, 
      deletedCalendarId 
    } = await request.json() as {
      reservationId: string
      action: 'create' | 'update' | 'delete'
      deletedEventId?: string | null
      deletedCalendarId?: string | null
    }

    if (!action) {
      return NextResponse.json({ ok: false, error: 'Missing action parameter' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const syncToken = process.env.SYNC_API_TOKEN || 'yoyakl_sync_token_2026'

    // 1. 物理削除アクションの場合の処理
    if (action === 'delete') {
      const eventId = deletedEventId
      const calendarId = deletedCalendarId

      // カレンダーIDまたはイベントIDがない場合は同期不可のためスキップ
      if (!eventId || !calendarId) {
        console.log('[CalendarSync] Missing eventId or calendarId for delete action. Skipping.')
        return NextResponse.json({ ok: true, message: 'No event ID mapping found. Skipped delete.' })
      }

      // 店舗設定から GAS ウェブアプリURL をロード
      let gasUrl = process.env.GAS_CALENDAR_SYNC_URL
      try {
        const { data: settingsData } = await supabase
          .from('system_settings')
          .select('gas_calendar_sync_url')
          .eq('google_calendar_id', calendarId)
          .maybeSingle()
        if (settingsData?.gas_calendar_sync_url) {
          gasUrl = settingsData.gas_calendar_sync_url
        }
      } catch (err) {
        console.warn('[CalendarSync] Failed to fetch gas_calendar_sync_url for deletion:', err)
      }

      if (!gasUrl) {
        console.warn('[CalendarSync] GAS URL is not configured. Skipping delete.')
        return NextResponse.json({ ok: true, message: 'GAS URL not configured. Skipped delete.' })
      }

      console.log(`[CalendarSync] Sending delete request to GAS for event: ${eventId} on calendar: ${calendarId} to: ${gasUrl}`)
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          calendarId,
          eventId,
          token: syncToken
        })
      })

      const result = await response.json() as { ok: boolean; error?: string }
      if (!response.ok || !result.ok) {
        throw new Error(result.error || `HTTP error ${response.status}`)
      }

      return NextResponse.json({ ok: true, message: 'Event deleted from calendar successfully' })
    }

    // 2. 作成・更新・キャンセルアクションの場合、DBから予約詳細を取得
    const { data: res, error: resError } = await supabase
      .from('reservations')
      .select(`
        *,
        customers(name),
        courses(name, duration),
        therapists:therapists!therapist_id(name)
      `)
      .eq('id', reservationId)
      .maybeSingle()

    if (resError) throw resError
    if (!res) {
      console.warn(`[CalendarSync] Reservation ${reservationId} not found in DB. Skipping.`)
      return NextResponse.json({ ok: false, error: 'Reservation not found' }, { status: 404 })
    }

    // 別クエリで system_settings を shop_id から取得
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('google_calendar_id, gas_calendar_sync_url')
      .eq('shop_id', res.shop_id)
      .maybeSingle()

    if (settingsError) {
      console.warn(`[CalendarSync] Failed to fetch system_settings for shop ${res.shop_id}:`, settingsError)
    }

    const calendarId = settingsData?.google_calendar_id
    if (!calendarId) {
      // カレンダーIDが未設定の店舗の場合は同期を安全にスキップ
      console.log(`[CalendarSync] Google Calendar ID is not configured for shop: ${res.shop_id}. Skipping.`)
      return NextResponse.json({ ok: true, message: 'Calendar ID not configured. Skipped.' })
    }

    const gasUrl = settingsData?.gas_calendar_sync_url || process.env.GAS_CALENDAR_SYNC_URL
    if (!gasUrl) {
      console.warn(`[CalendarSync] GAS URL is not configured for shop: ${res.shop_id}. Skipping sync.`)
      return NextResponse.json({ ok: true, message: 'GAS URL not configured. Skipped.' })
    }

    const eventId = res.google_event_id

    // 過去データ保護：更新・キャンセル時に google_event_id が無い場合は同期をスキップ
    if (action === 'update' && !eventId) {
      console.log(`[CalendarSync] Skip update since google_event_id is NULL for reservation: ${reservationId}`)
      return NextResponse.json({ ok: true, message: 'Past reservation without event ID. Skipped sync.' })
    }

    // 3. アクションの判定 (キャンセルステータスの場合は cancel に切り替える)
    let finalAction: 'create' | 'update' | 'delete' | 'cancel' = action
    if (action === 'update' && res.status === 'cancelled') {
      finalAction = 'cancel'
    }

    // 4. タイトルのフォーマット作成
    const therapistName = res.therapists?.name || '指名なし'
    const customerName = res.customers?.name || 'ゲスト'
    const courseDuration = res.courses?.duration || 0
    
    // 指名区分の日本語ラベル化
    let designationLabel = 'フリー'
    switch (res.designation_type) {
      case 'confirmed':
        designationLabel = '本指名'
        break
      case 'nomination':
        designationLabel = '指名'
        break
      case 'first_nomination':
        designationLabel = '初回指名'
        break
      case 'princess':
        designationLabel = '姫予約'
        break
    }

    // タイトルフォーマット: [セラピスト名]さん [お客様名]様 [コース時間]分 [指名区分] [開始時刻]〜[終了時刻]
    const timeDisplay = `${res.start_time.slice(0, 5)}〜${res.end_time.slice(0, 5)}`
    const title = `${therapistName}さん ${customerName}様 ${courseDuration}分 ${designationLabel} ${timeDisplay}`

    // 5. GASにリクエストを送信
    console.log(`[CalendarSync] Sending ${finalAction} request to GAS for calendar: ${calendarId}`)
    const payload = {
      action: finalAction,
      calendarId,
      eventId,
      title,
      date: res.date,
      startTime: res.start_time.slice(0, 5),
      endTime: res.end_time.slice(0, 5),
      token: syncToken
    }

    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const result = await response.json() as { ok: boolean; eventId?: string; error?: string }
    if (!response.ok || !result.ok) {
      throw new Error(result.error || `HTTP error ${response.status}`)
    }

    // 6. 新規作成時に返ってきた Google Event ID を予約レコードに保存
    if (action === 'create' && result.eventId) {
      console.log(`[CalendarSync] Saving google_event_id: ${result.eventId} for reservation: ${reservationId}`)
      const { error: updateError } = await supabase
        .from('reservations')
        .update({ google_event_id: result.eventId })
        .eq('id', reservationId)

      if (updateError) {
        console.error('[CalendarSync] Failed to save google_event_id to DB:', updateError.message)
      }
    }

    return NextResponse.json({ ok: true, message: `Calendar synchronized successfully (${finalAction})` })

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[CalendarSync] Synchronizing error:', msg, error)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
