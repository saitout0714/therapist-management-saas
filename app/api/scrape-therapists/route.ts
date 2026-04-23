import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URLが必要です' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY が設定されていません' }, { status: 500 })
    }

    let html: string
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'ja,en;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      html = await res.text()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '不明なエラー'
      return NextResponse.json({ error: `ページの取得に失敗しました: ${msg}` }, { status: 422 })
    }

    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000)

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `あなたはWebページのテキストからセラピストのプロフィール情報を一覧で抽出するアシスタントです。
JSON配列のみで返答してください。余分なテキストやマークダウンは一切含めないでください。

以下のWebページのテキストから、全セラピストのプロフィール情報を抽出し、JSON配列で返してください。

各セラピストのフィールド:
- name: 源氏名・芸名（文字列、必須）
- age: 年齢（数値、不明ならnull）
- height: 身長cm（数値、不明ならnull）
- bust: バストcm（数値、不明ならnull）
- bust_cup: バストカップ（A〜K等の文字列、不明ならnull）
- waist: ウエストcm（数値、不明ならnull）
- hip: ヒップcm（数値、不明ならnull）
- comment: コメント・自己紹介・店長おすすめ・セラピストメッセージ等（文字列、なければnull）

例: [{"name":"さくら","age":22,"height":158,"bust":86,"bust_cup":"D","waist":58,"hip":84,"comment":"明るく元気な笑顔が自慢です！"},{"name":"みゆき","age":null,"height":162,"bust":null,"bust_cup":null,"waist":null,"hip":null,"comment":null}]

名前が特定できない場合はそのエントリを含めないでください。
Webページのテキスト:
${stripped}`

    const result = await model.generateContent(prompt)
    const rawText = result.response.text().trim()

    let extracted: unknown[] = []
    try {
      const match = rawText.match(/\[[\s\S]*\]/)
      if (match) {
        extracted = JSON.parse(match[0])
      }
    } catch {
      return NextResponse.json({ error: `AIの応答を解析できませんでした。レスポンス: ${rawText.slice(0, 200)}` }, { status: 500 })
    }

    return NextResponse.json({ therapists: extracted })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: `サーバーエラー: ${msg}` }, { status: 500 })
  }
}
