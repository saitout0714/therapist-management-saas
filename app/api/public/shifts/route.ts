import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function getJstDateFromDateTime(dateStr: string, timeStr: string): Date {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number)
  let [h, m] = timeStr.split(':').map(Number)
  let extraDays = 0
  if (h >= 24) {
    extraDays = Math.floor(h / 24)
    h = h % 24
  }
  const utcMs = Date.UTC(yyyy, mm - 1, dd + extraDays, h, m) - 9 * 60 * 60 * 1000
  return new Date(utcMs)
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function timeToMinutesAbsolute(t: string, shiftStart: string): number {
  const [h, m] = t.split(':').map(Number)
  const [sh] = shiftStart.split(':').map(Number)
  let mins = h * 60 + m
  if (mins < sh * 60 - 60) mins += 24 * 60
  return mins
}

function generateSlots(shiftStart: string, shiftEnd: string, durationMin: number, intervalMin: number) {
  const slots: string[] = []
  const base = timeToMinutes(shiftStart)
  let current = base
  const end = timeToMinutesAbsolute(shiftEnd, shiftStart)
  while (current + durationMin <= end) {
    const h = Math.floor(current / 60)
    const m = current % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    current += intervalMin
  }
  return slots
}

function isSlotAvailable(
  slotStart: string,
  duration: number,
  reservations: any[],
  interval: number,
  shiftStart: string,
): boolean {
  const sStart = timeToMinutesAbsolute(slotStart, shiftStart)
  const sEnd = sStart + duration
  for (const res of reservations) {
    const rStart = timeToMinutesAbsolute(res.start_time, shiftStart)
    const rEnd = timeToMinutesAbsolute(res.end_time, shiftStart)
    if (res.status === 'blocked') {
      if (sStart < rEnd && sEnd > rStart) return false
    } else {
      if (sStart < rEnd + interval && sEnd + interval > rStart) return false
    }
  }
  return true
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const shop_id = searchParams.get('shop_id')
    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')
    const token = searchParams.get('token')

    const expectedToken = process.env.SYNC_API_TOKEN || 'yoyakl_sync_token_2026'
    if (token !== expectedToken) {
      return NextResponse.json({ error: '認証トークンが無効です' }, { status: 401 })
    }

    if (!shop_id) {
      return NextResponse.json({ error: 'shop_id が必要です' }, { status: 400 })
    }
    if (!date_from || !date_to) {
      return NextResponse.json({ error: 'date_from と date_to が必要です' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const [shiftsRes, coursesRes, reservationsRes, settingsRes] = await Promise.all([
      supabase
        .from('shifts')
        .select(`
          id,
          date,
          start_time,
          end_time,
          notes,
          therapists (id, name, comment, reservation_interval_minutes, x_url),
          rooms (id, name)
        `)
        .eq('shop_id', shop_id)
        .gte('date', date_from)
        .lte('date', date_to)
        .order('date', { ascending: true }),
      supabase
        .from('courses')
        .select('duration')
        .eq('shop_id', shop_id)
        .eq('is_active', true),
      supabase
        .from('reservations')
        .select('therapist_id, date, start_time, end_time, status')
        .eq('shop_id', shop_id)
        .gte('date', date_from)
        .lte('date', date_to)
        .in('status', ['confirmed', 'blocked']),
      supabase
        .from('system_settings')
        .select('reservation_interval_minutes')
        .eq('shop_id', shop_id)
        .maybeSingle()
    ])

    if (shiftsRes.error) {
      throw new Error(`DBからの取得に失敗しました: ${shiftsRes.error.message}`)
    }

    const courses = coursesRes.data || []
    const minCourseDuration = courses.length > 0 ? Math.min(...courses.map(c => c.duration)) : 60
    const systemIntervalMinutes = (settingsRes.data as any)?.reservation_interval_minutes ?? 20
    const existingReservations = reservationsRes.data || []

    const now = new Date()
    const minAllowedTime = now.getTime() + 20 * 60 * 1000

    const formatted = (shiftsRes.data || []).map((s: any) => {
      const therapist = s.therapists || {}
      const room = s.rooms || {}

      const formatTimeStr = (t: string) => t ? t.slice(0, 5) : ''
      const interval = therapist.reservation_interval_minutes || systemIntervalMinutes
      const staffLabel = therapist.name ? `${therapist.name}${interval}` : ''

      const therapistReservations = existingReservations.filter(
        (r: any) => r.therapist_id === therapist.id && r.date === s.date
      )

      const allSlots = generateSlots(s.start_time, s.end_time, minCourseDuration, 5)
      let isImmediate = false
      const firstAvailSlot = allSlots.find(slot => {
        const isAvail = isSlotAvailable(slot, minCourseDuration, therapistReservations, interval, s.start_time)
        const slotJstDate = getJstDateFromDateTime(s.date, slot)
        const isTimeValid = slotJstDate.getTime() >= minAllowedTime
        
        if (isAvail && isTimeValid) {
          if (slotJstDate.getTime() <= now.getTime() + 35 * 60 * 1000) {
            isImmediate = true
          }
          return true
        }
        return false
      })

      return {
        date: s.date,
        therapist_name: therapist.name || '',
        staff_label: staffLabel,
        room_name: room.name || '',
        start_time: formatTimeStr(s.start_time),
        end_time: formatTimeStr(s.end_time),
        notes: s.notes || '',
        first_available_time: firstAvailSlot ? formatTimeStr(firstAvailSlot) : null,
        is_immediate: isImmediate,
        is_available: !!firstAvailSlot
      }
    })

    return NextResponse.json({ shifts: formatted })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: `サーバーエラー: ${msg}` }, { status: 500 })
  }
}
