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

  // JSTでの本日・昨日・1週間後の日付を計算（タイムゾーンと深夜営業対策）
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  
  const jstYesterday = new Date(jst.getTime() - 24 * 60 * 60 * 1000)
  const yesterdayStr = `${jstYesterday.getUTCFullYear()}-${String(jstYesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(jstYesterday.getUTCDate()).padStart(2, '0')}`
  
  const nextWeek = new Date(jst.getTime() + 7 * 24 * 60 * 60 * 1000)
  const nextWeekStr = `${nextWeek.getUTCFullYear()}-${String(nextWeek.getUTCMonth() + 1).padStart(2, '0')}-${String(nextWeek.getUTCDate()).padStart(2, '0')}`

  const [shopRes, coursesRes, shiftsRes, reservationsRes, settingsRes, therapistsRes, photosRes, backRulesRes] = await Promise.all([
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
        therapists (id, name, age, height, bust, bust_cup, waist, hip, comment, photo_url, hp_url, rank_id, is_active, is_rookie, reservation_interval_minutes,
          therapist_ranks (name))
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
    supabase
      .from('therapists')
      .select('id, name, age, height, bust, bust_cup, waist, hip, comment, photo_url, hp_url, rank_id, is_active, is_rookie, therapist_ranks (name)')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('therapist_photos')
      .select(`
        therapist_id, photo_url, display_order,
        therapists!inner (shop_id)
      `)
      .eq('therapists.shop_id', shopId)
      .order('display_order', { ascending: true }),
    supabase
      .from('shop_back_rules')
      .select('business_day_cutoff')
      .eq('shop_id', shopId)
      .maybeSingle()
  ])

  if (shopRes.error) {
    return NextResponse.json({ error: '店舗情報の取得に失敗しました' }, { status: 500, headers: CORS_HEADERS })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shifts = (shiftsRes.data || []).filter((s: any) => {
    const t = Array.isArray(s.therapists) ? s.therapists[0] : s.therapists
    return t?.is_active !== false
  })

  const photosMap: Record<string, string[]> = {}
  if (photosRes.data) {
    for (const row of (photosRes.data || []) as unknown as { therapist_id: string; photo_url: string }[]) {
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

  // 全アクティブセラピストにも写真を紐付け
  const therapistsWithPhotos = (therapistsRes.data || []).map((t: any) => {
    return {
      ...t,
      photos: photosMap[t.id] || [],
    }
  })

  // business_day_cutoffを取得 (HH:MM:SS 形式から HH:MM に整形)
  const business_day_cutoff = (backRulesRes.data as any)?.business_day_cutoff?.substring(0, 5) ?? '06:00'

  return NextResponse.json({
    shop: shopRes.data,
    courses: coursesRes.data || [],
    shifts: shiftsWithPhotos,
    reservations: reservationsRes.data || [],
    system_interval_minutes: (settingsRes.data as any)?.reservation_interval_minutes ?? 20,
    allow_new_customers: (settingsRes.data as any)?.allow_new_customers ?? true,
    therapists: therapistsWithPhotos,
    business_day_cutoff,
  }, {
    headers: CORS_HEADERS
  })
}
