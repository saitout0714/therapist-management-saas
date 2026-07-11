import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/[\s\u3000]+/g, '')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { text, shop_id } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'テキストを入力してください' }, { status: 400 })
    }
    if (!shop_id || typeof shop_id !== 'string') {
      return NextResponse.json({ error: '店舗を選択してください' }, { status: 400 })
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY が設定されていません' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. 店舗のセラピストとルーム一覧を取得
    const [therapistsRes, roomsRes] = await Promise.all([
      supabase.from('therapists').select('id, name').eq('shop_id', shop_id).eq('is_active', true),
      supabase.from('rooms').select('id, name').eq('shop_id', shop_id)
    ])

    if (therapistsRes.error) throw new Error(therapistsRes.error.message)
    if (roomsRes.error) throw new Error(roomsRes.error.message)

    const therapists = therapistsRes.data || []
    const rooms = roomsRes.data || []

    const therapistNames = therapists.map(t => t.name)
    const roomNames = rooms.map(r => r.name)

    const currentDate = new Date().toISOString().split('T')[0]

    // 2. Gemini API でテキスト解析
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `以下の「出勤シフトテキスト」を解析し、日付、セラピスト名、出勤時間、退勤時間、ルーム名を1件残らず抽出してください。省略は絶対に禁止です。

【出勤シフトテキスト】
${text}

【絶対厳守の解析命令】
1. シフト情報が記載されているすべてのスタッフを1件も漏らさずに抽出してください。
2. 日付は現在の日付（${currentDate}）やテキスト内のコンテキストを基準にし、必ず YYYY-MM-DD 形式にしてください。
3. 深夜時間（25:00や、翌2時を表す「18-2」の「2」等）は、「25:00」「02:00」のように適切に解釈し、開始時刻・終了時刻は必ず HH:MM 形式で出力してください。
4. テキスト内に明示的なルーム名またはエリア名が記載されている場合は、最もマッチするものを抽出してください。

【候補リスト】
セラピスト候補名一覧: ${therapistNames.join(', ')}
ルーム候補名一覧: ${roomNames.join(', ')}

出力形式:
必ず以下の構造を持つJSON配列形式のみで出力してください。余計なマークダウン装飾（\`\`\`json など）や説明文は一切含めないでください。
[
  {
    "date": "YYYY-MM-DD",
    "therapist_name": "抽出されたセラピスト名",
    "room_name": "抽出されたルーム名（ない場合はnull）",
    "start_time": "HH:MM",
    "end_time": "HH:MM"
  }
]`;

    const result = await model.generateContent(prompt)
    const rawText = result.response.text().trim()

    let parsedShifts: any[] = []
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        parsedShifts = JSON.parse(jsonMatch[0])
      } else {
        parsedShifts = JSON.parse(rawText)
      }
    } catch (e) {
      return NextResponse.json({ error: `AIの出力をJSONとしてパースできませんでした: ${rawText}` }, { status: 500 })
    }

    // 3. データベースのUUIDとマッチング
    const resolvedShifts = parsedShifts.map((s: any) => {
      const extName = s.therapist_name || ''
      const extRoom = s.room_name || ''

      // セラピストマッチング（完全一致・部分一致）
      let matchedTherapist = therapists.find(t => normalizeName(t.name) === normalizeName(extName))
      if (!matchedTherapist) {
        matchedTherapist = therapists.find(t => normalizeName(t.name).includes(normalizeName(extName)) || normalizeName(extName).includes(normalizeName(t.name)))
      }

      // ルームマッチング（完全一致・部分一致）
      let matchedRoom = rooms.find(r => normalizeName(r.name) === normalizeName(extRoom))
      if (!matchedRoom && extRoom) {
        matchedRoom = rooms.find(r => normalizeName(r.name).includes(normalizeName(extRoom)) || normalizeName(extRoom).includes(normalizeName(r.name)))
      }

      return {
        date: s.date,
        therapist_id: matchedTherapist?.id || null,
        therapist_name: matchedTherapist?.name || extName,
        room_id: matchedRoom?.id || null,
        room_name: matchedRoom?.name || extRoom || null,
        start_time: s.start_time,
        end_time: s.end_time,
        matched: !!matchedTherapist
      }
    })

    return NextResponse.json({ shifts: resolvedShifts })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: `サーバーエラー: ${msg}` }, { status: 500 })
  }
}
