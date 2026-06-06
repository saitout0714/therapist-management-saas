import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { shifts, shop_id } = body

    if (!Array.isArray(shifts) || shifts.length === 0) {
      return NextResponse.json({ error: '保存するシフト情報がありません' }, { status: 400 })
    }
    if (!shop_id) {
      return NextResponse.json({ error: '店舗を選択してください' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 重複防止のため、今回登録する日付・セラピストの既存シフトを先に削除
    // 各日付とセラピストのペアを特定
    const dates = Array.from(new Set(shifts.map(s => s.date)))
    const therapistIds = Array.from(new Set(shifts.map(s => s.therapist_id).filter(Boolean)))

    if (therapistIds.length > 0 && dates.length > 0) {
      const { error: deleteError } = await supabase
        .from('shifts')
        .delete()
        .eq('shop_id', shop_id)
        .in('date', dates)
        .in('therapist_id', therapistIds)

      if (deleteError) throw new Error(`既存シフトの削除に失敗しました: ${deleteError.message}`)
    }

    // データベースにインサートする行をビルド
    const rows = shifts
      .filter(s => s.therapist_id && s.date && s.start_time && s.end_time)
      .map(s => {
        // 時刻フォーマットを HH:MM:00 に整形
        const formatTime = (t: string) => {
          const parts = t.split(':')
          const h = String(parseInt(parts[0], 10)).padStart(2, '0')
          const m = String(parseInt(parts[1] || '0', 10)).padStart(2, '0')
          return `${h}:${m}:00`
        }

        return {
          shop_id: shop_id,
          therapist_id: s.therapist_id,
          room_id: s.room_id || null,
          date: s.date,
          start_time: formatTime(s.start_time),
          end_time: formatTime(s.end_time)
        }
      })

    // JavaScript側でキー（セラピスト_日付_開始時刻_終了時刻）の重複を排除
    const uniqueRowsMap = new Map()
    for (const row of rows) {
      const key = `${row.therapist_id}_${row.date}_${row.start_time}_${row.end_time}`
      uniqueRowsMap.set(key, row)
    }
    const uniqueRows = Array.from(uniqueRowsMap.values())

    if (uniqueRows.length === 0) {
      return NextResponse.json({ error: '有効なシフトデータがありませんでした' }, { status: 400 })
    }

    const { data, error: insertError } = await supabase
      .from('shifts')
      .upsert(uniqueRows, { onConflict: 'therapist_id,date,start_time,end_time' })
      .select('id')

    if (insertError) {
      throw new Error(`シフトの挿入に失敗しました: ${insertError.message}`)
    }


    return NextResponse.json({ success: true, count: data.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: `サーバーエラー: ${msg}` }, { status: 500 })
  }
}
