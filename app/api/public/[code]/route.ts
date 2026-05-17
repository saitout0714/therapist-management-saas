import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    return NextResponse.json({ error: '予約ページが見つかりません' }, { status: 404 })
  }
  if (!codeRow.is_active) {
    return NextResponse.json({ error: 'このページは現在ご利用いただけません' }, { status: 403 })
  }

  const shopId = codeRow.shop_id

  // 店舗情報・コース・本日から7日分のシフトを並行取得
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 6)
  const nextWeekStr = nextWeek.toISOString().split('T')[0]

  const [shopRes, coursesRes, shiftsRes] = await Promise.all([
    supabase.from('shops').select('id, name, short_name, description').eq('id', shopId).single(),
    supabase
      .from('courses')
      .select('id, name, duration, base_price')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .order('display_order', { ascending: true, nullsFirst: false }),
    supabase
      .from('shifts')
      .select(`
        id, date, start_time, end_time,
        therapists (id, name, age, height, bust, bust_cup, waist, hip, comment, photo_url, rank_id, is_active, reservation_interval_minutes,
          therapist_ranks (name))
      `)
      .eq('shop_id', shopId)
      .gte('date', todayStr)
      .lte('date', nextWeekStr)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true }),
  ])

  if (shopRes.error) {
    return NextResponse.json({ error: '店舗情報の取得に失敗しました' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shifts = (shiftsRes.data || []).filter((s: any) => {
    const t = Array.isArray(s.therapists) ? s.therapists[0] : s.therapists
    return t?.is_active !== false
  })

  // シフトに出勤しているセラピストIDを収集して写真を取得
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const therapistIds = [...new Set(shifts.map((s: any) => {
    const t = Array.isArray(s.therapists) ? s.therapists[0] : s.therapists
    return t?.id
  }).filter(Boolean))] as string[]

  const photosMap: Record<string, string[]> = {}
  if (therapistIds.length > 0) {
    const { data: photosData } = await supabase
      .from('therapist_photos')
      .select('therapist_id, photo_url, display_order')
      .in('therapist_id', therapistIds)
      .order('display_order', { ascending: true })
    for (const row of (photosData || []) as { therapist_id: string; photo_url: string }[]) {
      if (!photosMap[row.therapist_id]) photosMap[row.therapist_id] = []
      photosMap[row.therapist_id].push(row.photo_url)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shiftsWithPhotos = shifts.map((s: any) => {
    const t = Array.isArray(s.therapists) ? s.therapists[0] : s.therapists
    if (!t) return s
    return {
      ...s,
      therapists: { ...t, photos: photosMap[t.id] || [] },
    }
  })

  return NextResponse.json({
    shop: shopRes.data,
    courses: coursesRes.data || [],
    shifts: shiftsWithPhotos,
  })
}
