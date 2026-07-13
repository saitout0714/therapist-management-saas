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

  // 2. 店舗基本情報と設定のみを並行取得（軽量クエリ）
  const [shopRes, settingsRes] = await Promise.all([
    supabase.from('shops').select('id, name, short_name, description').eq('id', shopId).single(),
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

  // 3. 最小限の初期データを構築してクライアントに渡す
  const initialData = {
    shop: shopRes.data,
    courses: [],
    shifts: [],
    reservations: [],
    system_interval_minutes: settingsRes.data?.reservation_interval_minutes ?? 20,
    allow_new_customers: settingsRes.data?.allow_new_customers ?? true,
    code,
  }

  return <ReserveClient initialData={initialData} />
}
