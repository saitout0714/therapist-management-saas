const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

function resolveUrl(base, relative) {
  try { return new URL(relative, base).toString() } catch { return '' }
}

function extractImageUrls(html, baseUrl) {
  const urls = new Set()
  const patterns = [
    /\b(?:src|data-src|data-original|data-lazy|data-img)=["']([^"']+)["']/gi,
    /srcset=["']([^"']+)["']/gi,
  ]
  for (const pattern of patterns) {
    for (const m of html.matchAll(pattern)) {
      const raw = m[1].split(',')[0].trim().split(/\s+/)[0]
      if (!raw || raw.startsWith('data:')) continue
      const abs = resolveUrl(baseUrl, raw)
      if (!abs.startsWith('http')) continue
      if (!/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(abs)) continue
      if (/logo|icon|banner|pixel|tracking|spacer|noimage|no_image|dummy|menu|bg|btn|header|footer/i.test(abs)) continue
      urls.add(abs)
    }
  }
  return [...urls].slice(0, 20)
}

async function test() {
  const url = 'https://carezza.esthe-hp.com/item_10038611.html'; // 松下櫻子
  const name = '愛川野乃'; // Mismatched name
  
  console.log(`Fetching ${url} for therapist ${name}`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    }
  });
  const html = await res.text();
  const imageUrls = extractImageUrls(html, url);

  const pageText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);

  const apiKey = process.env.GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const imageSection = imageUrls.length > 0
    ? `\nページ内の画像URL（プロフィール写真と思われるものを photo_url に1つ選んでください）:\n${imageUrls.join('\n')}\n`
    : '';

  const prompt = `以下はセラピスト「${name}」の個人プロフィールページのテキストです。
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
- photo_url: プロフィール写真のURL（上記の画像URL候補の中から最も本人らしいものを1つ、なければnull）
例: {"age":22,"height":158,"bust":86,"bust_cup":"D","waist":58,"hip":84,"rank":"プレミアム","comment":"よろしくお願いします！","photo_url":"https://example.com/cast/img/abc.jpg"}
テキスト:
${pageText}`;

  const result = await model.generateContent(prompt);
  const rawText = result.response.text().trim();
  console.log('Gemini Raw Response:', rawText);
}

test();
