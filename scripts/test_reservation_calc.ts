import dotenv from 'dotenv'
import path from 'path'

// Load env variables FIRST
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function run() {
  const { createClient } = await import('@supabase/supabase-js')
  const { resolveCustomerPrice, calculateBack } = await import('../lib/calculateBack')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(url, key)

  console.log('--- 予約計算テスト開始 ---')
  const shopId = 'a0000001-0000-0000-0000-000000000001' // SPA RICH
  const courseId = 'c0000001-0001-0000-0000-000000000001' // コミ60分 (base_price: 16000)
  const rankId = 'b0000001-0000-0000-0000-000000000001' // シルバー
  
  // 1. コース情報の取得
  const { data: course, error: courseErr } = await supabase
    .from('courses')
    .select('base_price, name, back_amount, duration')
    .eq('id', courseId)
    .single()
  
  if (courseErr) {
    console.error('コース取得失敗:', courseErr)
    return
  }
  console.log('取得コース:', course)

  // 2. 指名タイプ: 本指名（confirmed）のテスト
  console.log('\n--- テスト1: 本指名（confirmed）---')
  const designationType = 'confirmed'

  // designation_types から設定を取得
  const { data: dtRow } = await supabase
    .from('designation_types')
    .select('id, slug, is_store_paid_back, default_fee')
    .eq('shop_id', shopId)
    .eq('slug', designationType)
    .maybeSingle()
  console.log('指名区分設定:', dtRow)

  const resolvedPrice = await resolveCustomerPrice(
    shopId,
    courseId,
    rankId,
    designationType,
    course.base_price,
    supabase
  )
  console.log('価格解決結果 resolvedPrice:', resolvedPrice)

  let basePrice = resolvedPrice.customerPrice
  let nominationFee = 0

  if (designationType !== 'free' && !dtRow?.is_store_paid_back) {
    if (resolvedPrice.customerPrice > course.base_price) {
      nominationFee = 0
    } else {
      // 本指名の matrix が base_price と同額（16000）なので、フォールバックから指名料を取得するはず
      // system_settings または therapist_pricing から取得
      const { data: systemSettings } = await supabase
        .from('system_settings')
        .select('default_nomination_fee, default_confirmed_nomination_fee, default_princess_reservation_fee')
        .eq('shop_id', shopId)
        .maybeSingle()
      console.log('システム設定:', systemSettings)

      const defaultConfirmedFee = systemSettings?.default_confirmed_nomination_fee || 0
      nominationFee = defaultConfirmedFee
    }
  }

  console.log('算出された basePrice:', basePrice)
  console.log('算出された nominationFee:', nominationFee)
  console.log('算出された total_price (basePrice + nominationFee):', basePrice + nominationFee)

  // バック額の計算
  const backInput = {
    shopId,
    therapistId: 'e0000001-0000-0000-0000-000000000001', // ダミーまたはシード
    therapistRankId: rankId,
    therapistBackCalcType: 'fixed' as const,
    courseId,
    coursePrice: course.base_price,
    courseBackAmount: course.back_amount || 0,
    courseDuration: course.duration,
    designationType,
    nominationFee,
    options: [],
    discounts: [],
    date: '2026-05-21',
    startTime: '12:00',
    supabaseClient: supabase
  }

  try {
    const backResult = await calculateBack(backInput)
    console.log('バック計算結果:', backResult)
    console.log('  -> コースバック額:', backResult.courseBack)
    console.log('  -> 指名料バック額:', backResult.nominationBack)
    console.log('  -> 控除額（厚生費など）:', backResult.deductions)
    console.log('  -> ネットバック額 (netBack):', backResult.netBack)
    console.log('  -> 店舗収益 (shopRevenue):', backResult.shopRevenue)
  } catch (err) {
    console.error('バック計算失敗:', err)
  }

  console.log('--- 予約計算テスト終了 ---')
}

run()
