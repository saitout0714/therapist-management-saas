import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase の環境変数が設定されていません。.env.local を確認してください。')
  process.exit(1)
}

async function test() {
  console.log('🧪 スプレッドシート同期 API のテストを開始します...')
  const supabase = createClient(supabaseUrl, supabaseKey)

  // 1. テスト対象の店舗 (クイーンテラス) の存在確認
  const shopId = '960d84c5-d1cd-44bc-a39a-85f8ecc3d51a'
  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('id, name')
    .eq('id', shopId)
    .maybeSingle()

  if (shopError || !shop) {
    console.error('❌ テスト用店舗 (クイーンテラス) が見つかりません。店舗IDが正しいか確認してください。')
    return
  }
  console.log(`✅ 対象店舗: ${shop.name} (${shop.id})`)

  // 2. セラピストの取得 (モックデータ作成用)
  const { data: therapists, error: tError } = await supabase
    .from('therapists')
    .select('id, name')
    .eq('shop_id', shopId)
    .limit(1)

  if (tError || !therapists || therapists.length === 0) {
    console.error('❌ テスト用セラピストが見つかりません。')
    return
  }
  const testTherapistName = therapists[0].name
  console.log(`✅ テスト用セラピスト: ${testTherapistName}`)

  // 3. ルームの取得
  const { data: rooms, error: rError } = await supabase
    .from('rooms')
    .select('id, name')
    .eq('shop_id', shopId)
    .limit(1)

  const testRoomName = rooms && rooms.length > 0 ? rooms[0].name : 'ルーム'
  console.log(`✅ テスト用ルーム: ${testRoomName}`)

  // 4. API に送信するモックデータの構築
  const token = process.env.SYNC_API_TOKEN || 'yoyakl_sync_token_2026'
  const testDate = '2026-06-25' // 未来の日付でテスト

  const payload = {
    token,
    shopId,
    dates: [testDate],
    shifts: [
      {
        date: testDate,
        therapist_name: testTherapistName,
        room_name: testRoomName,
        start_time: '12:00',
        end_time: '18:00'
      }
    ],
    reservations: [
      {
        date: testDate,
        therapist_name: testTherapistName,
        customer_name: 'テスト顧客いとう',
        phone_suffix: '9146',
        start_time: '13:00',
        end_time: '14:20',
        duration: 80,
        designation_type: 'confirmed',
        notes: 'テスト予約\nk'
      }
    ]
  }

  // Request オブジェクトをモックして API を呼び出す
  console.log('🔄 API にリクエストを送信しています...')
  
  const req = new Request(`http://localhost:3000/api/public/sync-from-spreadsheet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  try {
    const { POST } = await import('../app/api/sync-from-spreadsheet/route')
    const res = await POST(req)
    const status = res.status
    const json = await res.json() as { success: boolean; error?: string }

    console.log(`\n--- API レスポンス (ステータス: ${status}) ---`)
    console.log(JSON.stringify(json, null, 2))

    if (status === 200 && json.success) {
      console.log('\n🎉 API テスト成功！DBにデータが同期されました。')

      // DB の中身を確認
      const { data: dbShifts } = await supabase
        .from('shifts')
        .select('*')
        .eq('shop_id', shopId)
        .eq('date', testDate)
      
      const { data: dbRes } = await supabase
        .from('reservations')
        .select('*, customers(*)')
        .eq('shop_id', shopId)
        .eq('date', testDate)

      console.log('\n--- 登録された出勤データ ---')
      console.log(JSON.stringify(dbShifts, null, 2))

      console.log('\n--- 登録された予約データ ---')
      console.log(JSON.stringify(dbRes, null, 2))

      // テストデータのクリーンアップ
      console.log('\n🧹 テストデータをクリーンアップしています...')
      await supabase.from('reservations').delete().eq('shop_id', shopId).eq('date', testDate)
      await supabase.from('shifts').delete().eq('shop_id', shopId).eq('date', testDate)
      console.log('✅ クリーンアップ完了。')
    } else {
      console.error('\n❌ API テスト失敗')
    }
  } catch (err) {
    console.error('\n❌ API 実行エラー:', err)
  }
}

test()
