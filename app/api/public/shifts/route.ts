import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const shop_id = searchParams.get('shop_id')
    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')
    const token = searchParams.get('token')

    // 簡易的なトークン認証でセキュリティを担保
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

    // 出勤枠情報を取得
    const { data: shiftsData, error } = await supabase
      .from('shifts')
      .select(`
        id,
        date,
        start_time,
        end_time,
        notes,
        therapists (id, name, comment, reservation_interval_minutes),
        rooms (id, name)
      `)
      .eq('shop_id', shop_id)
      .gte('date', date_from)
      .lte('date', date_to)
      .order('date', { ascending: true })

    if (error) {
      throw new Error(`DBからの取得に失敗しました: ${error.message}`)
    }

    // レスポンス用のデータ整形
    const formatted = (shiftsData || []).map((s: any) => {
      const therapist = s.therapists || {}
      const room = s.rooms || {}

      // 開始時間・終了時間を HH:MM 形式に整形
      const formatTimeStr = (t: string) => t ? t.slice(0, 5) : ''

      // インターバル数字があれば付与（例: "すい20"）
      const interval = therapist.reservation_interval_minutes || 20
      const staffLabel = therapist.name ? `${therapist.name}${interval}` : ''

      return {
        date: s.date,
        therapist_name: therapist.name || '',
        staff_label: staffLabel,
        room_name: room.name || '',
        start_time: formatTimeStr(s.start_time),
        end_time: formatTimeStr(s.end_time),
        notes: s.notes || ''
      }
    })

    return NextResponse.json({ shifts: formatted })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: `サーバーエラー: ${msg}` }, { status: 500 })
  }
}
