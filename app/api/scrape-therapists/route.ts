import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'

function resolveUrl(base: string, relative: string): string {
  try { return new URL(relative, base).toString() } catch { return '' }
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ページ内の全 <a href> を収集し、個人ページURL候補を返す
function extractCandidateUrls(html: string, baseUrl: string): string[] {
  const seen = new Set<string>()
  const results: string[] = []
  let base: URL
  try { base = new URL(baseUrl) } catch { return [] }

  const pattern = /<a[^>]+href=["']([^"']+)["']/gi
  for (const m of html.matchAll(pattern)) {
    const href = m[1].trim()
    if (!href || href.startsWith('#') || href.startsWith('javascript') || href.startsWith('mailto')) continue
    const abs = resolveUrl(baseUrl, href)
    if (!abs || seen.has(abs)) continue
    try {
      const u = new URL(abs)
      if (u.hostname !== base.hostname) continue
      if (/\.(css|js|jpg|jpeg|png|gif|webp|svg|ico|pdf|zip)(\?|$)/i.test(u.pathname)) continue
      if (/\/(top|index\.html?|contact|access|news|blog|recruit|privacy|terms|sitemap|login|logout|cart|mypage)(\/|$|\?)/i.test(u.pathname)) continue
      if (abs === baseUrl || abs === baseUrl + '/') continue
      seen.add(abs)
      results.push(abs)
    } catch { continue }
  }

  // 最多パスプレフィックスで絞り込む（個人ページ群の特定）
  if (results.length > 5) {
    const prefixCount: Record<string, number> = {}
    for (const u of results) {
      try {
        const parts = new URL(u).pathname.split('/').filter(Boolean)
        if (parts.length >= 1) {
          const prefix = '/' + parts[0] + '/'
          prefixCount[prefix] = (prefixCount[prefix] || 0) + 1
        }
      } catch { continue }
    }
    const sorted = Object.entries(prefixCount).sort((a, b) => b[1] - a[1])
    const top = sorted[0]
    if (top && top[1] >= 3 && top[1] >= (sorted[1]?.[1] ?? 0) * 1.5) {
      const filtered = results.filter(u => {
        try { return new URL(u).pathname.startsWith(top[0]) } catch { return false }
      })
      if (filtered.length >= 2) return filtered.slice(0, 80)
    }
  }

  return results.slice(0, 80)
}

// 各候補URLのHTML内の位置を探し、周辺テキスト（名前が含まれる）を抽出する
function extractUrlContexts(html: string, baseUrl: string, candidateUrls: string[]): { url: string; context: string }[] {
  const results: { url: string; context: string }[] = []
  let baseOrigin: string
  try { baseOrigin = new URL(baseUrl).origin } catch { return [] }

  for (const absUrl of candidateUrls) {
    let relPath: string
    try { relPath = absUrl.replace(baseOrigin, '') } catch { continue }

    // href属性の位置をHTMLから探す
    const re = new RegExp(`href=["'][^"']*${escRe(relPath)}["']`, 'i')
    const match = html.match(re)
    if (!match) continue
    const idx = html.indexOf(match[0])
    if (idx === -1) continue

    // 前後のHTMLウィンドウからテキストを抽出（名前・年齢などが含まれる範囲）
    const snippet = html.slice(Math.max(0, idx - 300), Math.min(html.length, idx + 600))
    const context = snippet
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120)

    if (context) results.push({ url: absUrl, context })
  }

  return results
}

function extractPageText(html: string, maxLen = 10000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

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

    const pageText = extractPageText(html)
    const candidateUrls = extractCandidateUrls(html, url)
    const urlContexts = extractUrlContexts(html, url, candidateUrls)

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ]
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', safetySettings })

    // URL候補と周辺テキストをセットで渡す（数字IDのURLでも名前と対応付けられる）
    const urlSection = urlContexts.length > 0
      ? `\n個人ページURL候補（URLとその周辺テキスト）:\n${urlContexts.map(c => `${c.url} → ${c.context}`).join('\n')}\n`
      : ''

    const prompt = `あなたはWebページのテキストからセラピストのプロフィール情報を一覧で抽出するアシスタントです。
JSON配列のみで返答してください。余分なテキストやマークダウンは一切含めないでください。
${urlSection}
以下のWebページのテキストから、全セラピストのプロフィール情報を抽出し、JSON配列で返してください。
URL候補が提供されている場合、周辺テキストの名前・年齢などを手がかりに対応するURLを profile_url に選んでください。

各セラピストのフィールド:
- name: 源氏名・芸名（文字列、必須）
- age: 年齢（数値、不明ならnull）
- height: 身長cm（数値、不明ならnull）
- bust: バストcm（数値、不明ならnull）
- bust_cup: バストカップ（A〜K等の文字列、不明ならnull）
- waist: ウエストcm（数値、不明ならnull）
- hip: ヒップcm（数値、不明ならnull）
- comment: コメント・自己紹介・店長おすすめ等（文字列、なければnull）
- profile_url: 上記URL候補からこのセラピストの個人ページURL（なければnull）
- rank: ランク・コース・クラス表記（例: "A", "プレミアム", "新人" など、なければnull）

名前が特定できない場合はそのエントリを含めないでください。
Webページのテキスト:
${pageText}`

    const result = await model.generateContent(prompt)
    const candidate = result.response.candidates?.[0]
    if (!candidate || candidate.finishReason === 'SAFETY' || candidate.finishReason === 'PROHIBITED_CONTENT') {
      return NextResponse.json({ therapists: [], blocked: true })
    }
    const rawText = result.response.text().trim()

    let extracted: unknown[] = []
    try {
      const match = rawText.match(/\[[\s\S]*\]/)
      if (match) extracted = JSON.parse(match[0])
    } catch {
      return NextResponse.json({ error: `AIの応答を解析できませんでした。レスポンス: ${rawText.slice(0, 200)}` }, { status: 500 })
    }

    // 候補リスト外のURLは破棄（ハルシネーション対策）
    const candidateSet = new Set(candidateUrls)
    const enriched = (extracted as Array<Record<string, unknown>>).map(t => {
      const pu = t.profile_url
      if (!pu || typeof pu !== 'string') return t
      if (candidateSet.size > 0 && !candidateSet.has(pu)) return { ...t, profile_url: null }
      return t
    })

    return NextResponse.json({ therapists: enriched })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: `サーバーエラー: ${msg}` }, { status: 500 })
  }
}
