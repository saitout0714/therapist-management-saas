// 裏妻スパの精算・指名料デバッグスクリプト
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://pumkniqtgjsotsxhyvbq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bWtuaXF0Z2pzb3RzeGh5dmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NzY3ODYsImV4cCI6MjA4MjA1Mjc4Nn0.WVZgU78F7OarsfE0wJy7sby0n-WDVtTVUEucCf4cUiU'
)

async function main() {
  // 1. 裏妻スパのshop_idを取得
  const { data: shops } = await supabase.from('shops').select('id, name').ilike('name', '%裏妻%')
  console.log('=== 裏妻スパ ===')
  console.log(shops)

  if (!shops || shops.length === 0) {
    console.log('裏妻スパが見つかりません')
    return
  }

  const shopId = shops[0].id
  console.log('\nShop ID:', shopId)

  // 2. designation_types の確認
  const { data: dt } = await supabase
    .from('designation_types')
    .select('slug, display_name, default_fee, default_back_amount, is_active')
    .eq('shop_id', shopId)
  console.log('\n=== designation_types ===')
  console.log(JSON.stringify(dt, null, 2))

  // 3. course_back_amounts の確認（ランク別設定）
  const { data: cba } = await supabase
    .from('course_back_amounts')
    .select('course_id, rank_id, designation_type, back_amount, customer_price, course_price_override')
    .eq('shop_id', shopId)
    .limit(10)
  console.log('\n=== course_back_amounts（最大10件）===')
  console.log(JSON.stringify(cba, null, 2))

  // 4. 最近の予約の nomination_fee を確認
  const { data: reservations } = await supabase
    .from('reservations')
    .select('id, designation_type, nomination_fee, base_price, total_price, therapist_back_amount')
    .eq('shop_id', shopId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(10)
  console.log('\n=== 最近の予約（最大10件）nomination_fee確認 ===')
  console.log(JSON.stringify(reservations, null, 2))

  // 5. shop_back_rules の確認
  const { data: backRules } = await supabase
    .from('shop_back_rules')
    .select('nomination_calc_type, nomination_back_rate, nomination_back_amount')
    .eq('shop_id', shopId)
  console.log('\n=== shop_back_rules ===')
  console.log(JSON.stringify(backRules, null, 2))
}

main().catch(console.error)
