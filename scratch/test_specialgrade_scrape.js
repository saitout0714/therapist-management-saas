const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
  const url = 'https://esthe-specialgrade.com/cast/%e5%a4%95%e5%87%aa%e3%81%bb%e3%81%ae/';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const html = await res.text();
  const pageText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 15000);

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `以下はセラピスト「夕凪ほの」の個人プロフィールページのテキストです。
プロフィール情報をJSONオブジェクトで返してください。

フィールド:
- age: 年齢（数値またはnull）
- height: 身長（数値またはnull）
- bust: バスト（数値またはnull）
- bust_cup: カップ（文字列またはnull）
- waist: ウエスト（数値またはnull）
- hip: ヒップ（数値またはnull）
- rank: ランク（文字列またはnull）
- comment: 自己紹介・プロフィールコメント・店舗からの推薦文（「ガチ恋注意」「つるすべ」のような単なる短いキーワードタグ群ではなく、ページ下部にある「Comment / コメント」や店舗からの推薦文・自己紹介文などの詳細なコメント文章・メッセージ本文を優先して全文抽出してください。改行区切りの長文可）

テキスト:
${pageText}`;

  const result = await model.generateContent(prompt);
  console.log('Result raw text:');
  console.log(result.response.text());
}

test();
