import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'public, max-age=10, s-maxage=60, stale-while-revalidate=120',
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const supabase = getServiceClient()

  // コードから店舗を取得
  const { data: codeRow, error: codeError } = await supabase
    .from('shop_reservation_codes')
    .select('shop_id, is_active')
    .eq('code', code)
    .single()

  if (codeError || !codeRow) {
    return NextResponse.json({ error: '予約ページが見つかりません' }, { status: 404, headers: CORS_HEADERS })
  }
  if (!codeRow.is_active) {
    return NextResponse.json({ error: 'このページは現在ご利用いただけません' }, { status: 403, headers: CORS_HEADERS })
  }

  const shopId = codeRow.shop_id

  const { data: shopRow, error: shopError } = await supabase
    .from('shops')
    .select('id, name, short_name, description, owner_id, theme_color, has_hp, template_id')
    .eq('id', shopId)
    .single()
  if (shopError || !shopRow) {
    return NextResponse.json({ error: '店舗情報の取得に失敗しました' }, { status: 500, headers: CORS_HEADERS })
  }

  // グループの扱い方（全店共通 or 店舗ごと）を確認し、在籍テーブル基準で
  // 対象セラピストを決める。shop_id 直接一致にはもう頼らない
  // （在籍していない店舗のHPにまで人が出てしまう不具合の原因だった）。
  let scope: 'all_shops' | 'per_shop' = 'per_shop'
  let groupShopIds = [shopId]
  if (shopRow.owner_id) {
    const { data: ownerRow } = await supabase.from('owners').select('therapist_scope').eq('id', shopRow.owner_id).maybeSingle()
    scope = (ownerRow?.therapist_scope as 'all_shops' | 'per_shop' | undefined) ?? 'per_shop'
    if (scope === 'all_shops') {
      const { data: shopsData } = await supabase.from('shops').select('id').eq('owner_id', shopRow.owner_id)
      if (shopsData && shopsData.length > 0) groupShopIds = shopsData.map(s => s.id)
    }
  }

  let rosterRows: { therapist_id: string; alias_name: string | null; is_active: boolean; age: number | null; height: number | null; bust: number | null; bust_cup: string | null; waist: number | null; hip: number | null; comment: string | null; rank_id: string | null }[] = []
  if (scope === 'per_shop') {
    const { data } = await supabase
      .from('therapist_shops')
      .select('therapist_id, alias_name, is_active, age, height, bust, bust_cup, waist, hip, comment, rank_id')
      .eq('shop_id', shopId)
    rosterRows = data || []
  }
  const rosterMap = new Map(rosterRows.map(r => [r.therapist_id, r]))
  const eligibleIds = rosterRows.filter(r => r.is_active).map(r => r.therapist_id)

  // JSTでの本日・昨日・1週間後の日付を計算（タイムゾーンと深夜営業対策）
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)

  const jstYesterday = new Date(jst.getTime() - 24 * 60 * 60 * 1000)
  const yesterdayStr = `${jstYesterday.getUTCFullYear()}-${String(jstYesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(jstYesterday.getUTCDate()).padStart(2, '0')}`

  const nextWeek = new Date(jst.getTime() + 7 * 24 * 60 * 60 * 1000)
  const nextWeekStr = `${nextWeek.getUTCFullYear()}-${String(nextWeek.getUTCMonth() + 1).padStart(2, '0')}-${String(nextWeek.getUTCDate()).padStart(2, '0')}`

  const [ranksRes, coursesRes, shiftsRes, reservationsRes, settingsRes, therapistsRes, photosRes, backRulesRes] = await Promise.all([
    supabase.from('therapist_ranks').select('id, name'),
    supabase
      .from('courses')
      .select('id, name, duration, base_price')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .eq('show_on_hp', true)
      .order('display_order', { ascending: true, nullsFirst: false }),
    supabase
      .from('shifts')
      .select(`
        id, date, start_time, end_time,
        therapists (id, name, age, height, bust, bust_cup, waist, hip, comment, photo_url, hp_url, x_url, bluesky_url, line_url, rank_id, is_active, is_rookie, reservation_interval_minutes)
      `)
      .eq('shop_id', shopId)
      .gte('date', yesterdayStr)
      .lte('date', nextWeekStr)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true }),
    supabase
      .from('reservations')
      .select('therapist_id, date, start_time, end_time, status')
      .eq('shop_id', shopId)
      .gte('date', yesterdayStr)
      .lte('date', nextWeekStr)
      .in('status', ['confirmed', 'blocked']),
    supabase
      .from('system_settings')
      .select('reservation_interval_minutes, allow_new_customers')
      .eq('shop_id', shopId)
      .maybeSingle(),
    scope === 'all_shops'
      ? supabase
          .from('therapists')
          .select('id, name, age, height, bust, bust_cup, waist, hip, comment, photo_url, hp_url, x_url, bluesky_url, line_url, rank_id, is_active, is_rookie')
          .in('shop_id', groupShopIds)
          .eq('is_active', true)
          .order('name', { ascending: true })
      : eligibleIds.length > 0
        ? supabase
            .from('therapists')
            .select('id, name, age, height, bust, bust_cup, waist, hip, comment, photo_url, hp_url, x_url, bluesky_url, line_url, rank_id, is_active, is_rookie')
            .in('id', eligibleIds)
            .order('name', { ascending: true })
        : Promise.resolve({ data: [] as any[], error: null }),
    scope === 'per_shop'
      ? supabase
          .from('therapist_photos')
          .select('therapist_id, photo_url, display_order')
          .eq('shop_id', shopId)
          .order('display_order', { ascending: true })
      : supabase
          .from('therapist_photos')
          .select(`
            therapist_id, photo_url, display_order,
            therapists!inner (shop_id)
          `)
          .in('therapists.shop_id', groupShopIds)
          .order('display_order', { ascending: true }),
    supabase
      .from('shop_back_rules')
      .select('business_day_cutoff')
      .eq('shop_id', shopId)
      .maybeSingle()
  ])

  const rankNameOf = new Map((ranksRes.data || []).map((r: any) => [r.id, r.name]))

  // 店舗ごとグループの見せ方（源氏名・年齢等・ランク）を適用する
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyRoster = (t: any) => {
    if (scope !== 'per_shop') return t
    const r = rosterMap.get(t.id)
    if (!r) return t
    return {
      ...t,
      name: r.alias_name || t.name,
      age: r.age ?? t.age,
      height: r.height ?? t.height,
      bust: r.bust ?? t.bust,
      bust_cup: r.bust_cup ?? t.bust_cup,
      waist: r.waist ?? t.waist,
      hip: r.hip ?? t.hip,
      comment: r.comment ?? t.comment,
      rank_id: r.rank_id ?? t.rank_id,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shifts = (shiftsRes.data || [])
    .filter((s: any) => {
      const t = Array.isArray(s.therapists) ? s.therapists[0] : s.therapists
      if (t?.is_active === false) return false
      if (scope === 'per_shop') {
        const r = rosterMap.get(t?.id)
        if (!r || r.is_active === false) return false
      }
      return true
    })

  const photosMap: Record<string, string[]> = {}
  if (photosRes.data) {
    for (const row of (photosRes.data || []) as unknown as { therapist_id: string; photo_url: string }[]) {
      if (!photosMap[row.therapist_id]) photosMap[row.therapist_id] = []
      photosMap[row.therapist_id].push(row.photo_url)
    }
  }

  // helper functions
  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const timeToMinutesAbsolute = (t: string, shiftStart: string) => {
    const [h, m] = t.split(':').map(Number)
    const [sh] = shiftStart.split(':').map(Number)
    let mins = h * 60 + m
    if (mins < sh * 60 - 60) mins += 24 * 60
    return mins
  }
  const generateSlots = (shiftStart: string, shiftEnd: string, durationMin: number, intervalMin: number) => {
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
  const isSlotAvailable = (slotStart: string, duration: number, reservations: any[], interval: number, shiftStart: string) => {
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
  const getJstDateFromDateTime = (dateStr: string, timeStr: string) => {
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

  const systemIntervalMinutes = (settingsRes.data as any)?.reservation_interval_minutes ?? 20
  const minCourseDuration = coursesRes.data && coursesRes.data.length > 0 ? Math.min(...coursesRes.data.map((c:any) => c.duration)) : 60
  const existingReservations = reservationsRes.data || []
  const minAllowedTime = now.getTime() + 20 * 60 * 1000

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shiftsWithPhotos = shifts.map((s: any) => {
    const rawT = Array.isArray(s.therapists) ? s.therapists[0] : s.therapists
    if (!rawT) return s
    const t = applyRoster(rawT)

    const interval = t.reservation_interval_minutes || systemIntervalMinutes
    const therapistReservations = existingReservations.filter(
      (r: any) => r.therapist_id === t.id && r.date === s.date
    )

    const allSlots = generateSlots(s.start_time, s.end_time, minCourseDuration, 5)
    let isImmediate = false
    const firstAvailSlot = allSlots.find((slot: string) => {
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
      ...s,
      first_available_time: firstAvailSlot ? firstAvailSlot.slice(0,5) : null,
      is_immediate: isImmediate,
      has_available_slot: !!firstAvailSlot,
      therapists: { ...t, therapist_ranks: t.rank_id ? { name: rankNameOf.get(t.rank_id) } : null, photos: photosMap[t.id] || [] },
    }
  })

  // 全アクティブセラピストにも写真を紐付け（店舗ごとグループは在籍店舗の見せ方を適用）
  const therapistsWithPhotos = (therapistsRes.data || []).map((rawT: any) => {
    const t = applyRoster(rawT)
    return {
      ...t,
      therapist_ranks: t.rank_id ? { name: rankNameOf.get(t.rank_id) } : null,
      photos: photosMap[t.id] || [],
    }
  })

  // business_day_cutoffを取得 (HH:MM:SS 形式から HH:MM に整形)
  const business_day_cutoff = (backRulesRes.data as any)?.business_day_cutoff?.substring(0, 5) ?? '06:00'

  return NextResponse.json({
    shop: { id: shopRow.id, name: shopRow.name, short_name: shopRow.short_name, description: shopRow.description, theme_color: shopRow.theme_color, has_hp: shopRow.has_hp, template_id: shopRow.template_id },
    courses: coursesRes.data || [],
    shifts: shiftsWithPhotos,
    reservations: reservationsRes.data || [],
    system_interval_minutes: systemIntervalMinutes,
    allow_new_customers: (settingsRes.data as any)?.allow_new_customers ?? true,
    therapists: therapistsWithPhotos,
    business_day_cutoff,
  }, {
    headers: CORS_HEADERS
  })
}
