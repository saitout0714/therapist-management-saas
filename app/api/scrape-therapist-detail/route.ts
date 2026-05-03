import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: NextRequest) {
  try {
    const { url, name } = await req.json()

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
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      html = await res.text()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '不明なエラー'
      return NextResponse.json({ error: `ページの取得に失敗しました: ${msg}` }, { status: 422 })
    }

    const pageText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000)

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `以下はセラピスト「${name ?? ''}」の個人プロフィールページのテキストです。
プロフィール情報をJSONオブジェクトで返してください。余分なテキストは不要です。
フィールド:
- age: 年齢（数値またはnull）
- height: 身長cm（数値またはnull）
- bust: バストcm（数値またはnull）
- bust_cup: カップ（A〜K等の文字列またはnull）
- waist: ウエストcm（数値またはnull）
- hip: ヒップcm（数値またはnull）
- rank: ランク・コース・クラス表記（例: "A", "プレミアム", "姫" など、なければnull）
例: {"age":22,"height":158,"bust":86,"bust_cup":"D","waist":58,"hip":84,"rank":"プレミアム"}
テキスト:
${pageText}`

    const result = await model.generateContent(prompt)
    const rawText = result.response.text().trim()

    try {
      const match = rawText.match(/\{[\s\S]*?\}/)
      if (match) {
        const data = JSON.parse(match[0])
        return NextResponse.json({
          age: data.age ?? null,
          height: data.height ?? null,
          bust: data.bust ?? null,
          bust_cup: data.bust_cup ?? null,
          waist: data.waist ?? null,
          hip: data.hip ?? null,
          rank: data.rank ?? null,
        })
      }
    } catch {
      // パース失敗はnullで返す
    }

    return NextResponse.json({ age: null, height: null, bust: null, bust_cup: null, waist: null, hip: null, rank: null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: `サーバーエラー: ${msg}` }, { status: 500 })
  }
}
