import { createClient } from '@supabase/supabase-js'
import ReserveClient from './ReserveClient'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

interface PageProps {
  params: Promise<{ code: string }>
}

export default async function ReservePage({ params }: PageProps) {
  const { code } = await params
  const supabase = getServiceClient()

  // 1. コードから店舗IDを取得
  const { data: codeRow, error: codeError } = await supabase
    .from('shop_reservation_codes')
    .select('shop_id, is_active')
    .eq('code', code)
    .single()

  if (codeError || !codeRow || !codeRow.is_active) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-slate-700 font-medium">ご希望の予約ページが見つからないか、現在ご利用いただけません。</p>
        </div>
      </div>
    )
  }

  const shopId = codeRow.shop_id

  // 2. JSTの時間帯で、本日から7日間の日付範囲を計算する (UTCからの時差考慮)
  const jstOffset = 9 * 60 * 60 * 1000 // 9時間
  const now = new Date()
  const jstNow = new Date(now.getTime() + jstOffset)
  const todayStr = jstNow.toISOString().split('T')[0]

  const nextWeek = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000 + jstOffset)
  const nextWeekStr = nextWeek.toISOString().split('T')[0]

  // 3. 各データを並行取得
  const [shopRes, coursesRes, shiftsRes, reservationsRes, settingsRes] = await Promise.all([
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
    supabase
      .from('reservations')
      .select('therapist_id, date, start_time, end_time, status')
      .eq('shop_id', shopId)
      .gte('date', todayStr)
      .lte('date', nextWeekStr)
      .in('status', ['confirmed', 'blocked']),
    supabase
      .from('system_settings')
      .select('reservation_interval_minutes, allow_new_customers')
      .eq('shop_id', shopId)
      .maybeSingle(),
  ])

  if (shopRes.error || !shopRes.data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <p className="text-slate-700 font-medium">店舗情報の取得に失敗しました</p>
        </div>
      </div>
    )
  }

  // 4. therapist_photos の取得
  const shiftsData = shiftsRes.data || []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeShifts = shiftsData.filter((s: any) => {
    const t = Array.isArray(s.therapists) ? s.therapists[0] : s.therapists
    return t?.is_active !== false
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const therapistIds = [...new Set(activeShifts.map((s: any) => {
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
  const shiftsWithPhotos = activeShifts.map((s: any) => {
    const t = Array.isArray(s.therapists) ? s.therapists[0] : s.therapists
    if (!t) return s
    return {
      ...s,
      therapists: { ...t, photos: photosMap[t.id] || [] },
    }
  })

  // 5. ReserveClient に渡す initialData の構築
  const initialData = {
    shop: shopRes.data,
    courses: coursesRes.data || [],
    shifts: shiftsWithPhotos,
    reservations: reservationsRes.data || [],
    system_interval_minutes: settingsRes.data?.reservation_interval_minutes ?? 20,
    allow_new_customers: settingsRes.data?.allow_new_customers ?? true,
    code,
  }

  return <ReserveClient initialData={initialData} />
}
