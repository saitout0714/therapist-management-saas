import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

function resolveUrl(base: string, relative: string): string {
  try { return new URL(relative, base).toString() } catch { return '' }
}

function extractImageUrls(html: string, baseUrl: string): string[] {
  const urls = new Set<string>()
  // src / data-src / data-original / data-lazy / srcset の各属性を取得
  const patterns = [
    /\b(?:src|data-src|data-original|data-lazy|data-img)=["']([^"']+)["']/gi,
    /srcset=["']([^"']+)["']/gi,
  ]
  for (const pattern of patterns) {
    for (const m of html.matchAll(pattern)) {
      // srcset は "url 1x, url 2x" 形式なので最初のURLだけ
      const raw = m[1].split(',')[0].trim().split(/\s+/)[0]
      if (!raw || raw.startsWith('data:')) continue
      const abs = resolveUrl(baseUrl, raw)
      if (!abs.startsWith('http')) continue
      // 画像以外の拡張子（.js, .css など）を除外
      if (!/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(abs)) continue
      // ロゴ・アイコン・トラッキング・メニュー画像等と思われるものを除外
      if (/logo|icon|banner|pixel|tracking|spacer|noimage|no_image|dummy|menu|bg|btn|header|footer/i.test(abs)) continue
      urls.add(abs)
    }
  }
  return [...urls].slice(0, 50)
}

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

    const imageUrls = extractImageUrls(html, url)

    const pageText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000)

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const imageSection = imageUrls.length > 0
      ? `\nページ内の画像URL候補:\n${imageUrls.join('\n')}\n`
      : ''

    const prompt = `以下はセラピスト「${name ?? ''}」の個人プロフィールページのテキストです。
プロフィール情報をJSONオブジェクトで返してください。余分なテキストは不要です。
${imageSection}
フィールド:
- age: 年齢（数値またはnull）
- height: 身長cm（数値またはnull）
- bust: バストcm（数値またはnull）
- bust_cup: カップ（A〜K等の文字列またはnull）
- waist: ウエストcm（数値またはnull）
- hip: ヒップcm（数値またはnull）
- rank: ランク・コース・クラス表記（例: "A", "プレミアム", "姫" など、なければnull）
- comment: 自己紹介・プロフィールコメント（100文字以内の日本語文字列、なければnull）
- photo_url: プロフィール写真のURL（上記の画像URL候補の中から最も代表的な本人の写真を1つ、なければnull）
- photo_urls: プロフィール写真のURL配列（上記の画像URL候補の中から、本人の写真と思われるものを全て（最大30個程度）配列に含めてください。なければ空の配列 []）
例: {"age":22,"height":158,"bust":86,"bust_cup":"D","waist":58,"hip":84,"rank":"プレミアム","comment":"よろしくお願いします！","photo_url":"https://example.com/cast/img/abc.jpg","photo_urls":["https://example.com/cast/img/abc.jpg","https://example.com/cast/img/abc_2.jpg"]}
テキスト:
${pageText}`

    const result = await model.generateContent(prompt)
    const rawText = result.response.text().trim()

    try {
      const match = rawText.match(/\{[\s\S]*?\}/)
      if (match) {
        const data = JSON.parse(match[0])
        // photo_url が imageUrls に含まれているか確認（ハルシネーション対策）
        const photoUrl = data.photo_url && (imageUrls.includes(data.photo_url) || data.photo_url.startsWith('http'))
          ? data.photo_url
          : null

        // photo_urls のハルシネーション対策
        const rawPhotoUrls = Array.isArray(data.photo_urls) ? data.photo_urls : []
        const photoUrls = rawPhotoUrls
          .filter((u: any) => typeof u === 'string' && (imageUrls.includes(u) || u.startsWith('http'))) as string[]

        return NextResponse.json({
          age: data.age ?? null,
          height: data.height ?? null,
          bust: data.bust ?? null,
          bust_cup: data.bust_cup ?? null,
          waist: data.waist ?? null,
          hip: data.hip ?? null,
          rank: data.rank ?? null,
          comment: data.comment ?? null,
          photo_url: photoUrl,
          photo_urls: photoUrls.length > 0 ? photoUrls : (photoUrl ? [photoUrl] : []),
        })
      }
    } catch {
      // パース失敗はnullで返す
    }

    return NextResponse.json({ age: null, height: null, bust: null, bust_cup: null, waist: null, hip: null, rank: null, comment: null, photo_url: null, photo_urls: [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: `サーバーエラー: ${msg}` }, { status: 500 })
  }
}
