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

    // Googleスプレッドシートへの同期処理
    let gasSynced = false
    let gasMessage = ''
    const gasUrl = process.env.GAS_SHIFT_SYNC_URL

    if (gasUrl && uniqueRows.length > 0) {
      try {
        // セラピストとルームの情報をフェッチして、スプレッドシート出力用の表示名をマッピング
        const [therapistsRes, roomsRes] = await Promise.all([
          supabase.from('therapists').select('id, name, reservation_interval_minutes').eq('shop_id', shop_id),
          supabase.from('rooms').select('id, name').eq('shop_id', shop_id)
        ])

        const therapistsMap = new Map(therapistsRes.data?.map(t => [t.id, t]) || [])
        const roomsMap = new Map(roomsRes.data?.map(r => [r.id, r]) || [])

        const syncShifts = uniqueRows.map(row => {
          const therapist = therapistsMap.get(row.therapist_id)
          const room = row.room_id ? roomsMap.get(row.room_id) : null
          
          const interval = therapist?.reservation_interval_minutes ?? 20
          const staffLabel = therapist?.name ? `${therapist.name}${interval}` : ''
          
          const formatTimeStr = (t: string) => {
            if (!t) return ''
            const parts = t.split(':')
            return `${parts[0]}:${parts[1]}`
          }
          
          return {
            date: row.date,
            therapist_name: therapist?.name || '',
            staff_label: staffLabel,
            room_name: room?.name || '',
            start_time: formatTimeStr(row.start_time),
            end_time: formatTimeStr(row.end_time)
          }
        })

        const token = process.env.SYNC_API_TOKEN || 'yoyakl_sync_token_2026'
        const gasResponse = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            shopId: shop_id,
            shifts: syncShifts
          })
        })
        const gasResult = await gasResponse.json()
        if (gasResult.success) {
          gasSynced = true
          gasMessage = gasResult.message || '同期成功'
        } else {
          console.error('GAS sync returned error:', gasResult.error)
          gasMessage = gasResult.error || 'スプレッドシート書き込みエラー'
        }
      } catch (err) {
        console.error('Failed to sync to Google Spreadsheet:', err)
        gasMessage = err instanceof Error ? err.message : 'GAS通信エラー'
      }
    }

    return NextResponse.json({
      success: true,
      count: data.length,
      gasSynced,
      gasMessage
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: `サーバーエラー: ${msg}` }, { status: 500 })
  }
}
