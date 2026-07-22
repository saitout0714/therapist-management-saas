const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ]
});

async function run() {
  const { data: shop } = await supabase.from('shops').select('id, name').eq('name', 'SpecialGrade').single();
  if (!shop) {
    console.error('Shop SpecialGrade not found');
    return;
  }

  const { data: therapists } = await supabase
    .from('therapists')
    .select('id, name, hp_url, comment')
    .eq('shop_id', shop.id);

  console.log(`Found ${therapists.length} therapists for SpecialGrade`);

  for (const t of therapists) {
    if (!t.hp_url) continue;
    
    // Skip if comment is already long (more than 50 chars)
    if (t.comment && t.comment.length > 50 && !t.comment.includes('ガチ恋注意')) {
      // console.log(`Skipping ${t.name} (already long comment)`);
      // continue;
    }

    console.log(`Processing ${t.name}...`);

    try {
      const res = await fetch(t.hp_url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (!res.ok) continue;

      const html = await res.text();
      const pageText = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 25000);

      const prompt = `以下はセラピスト「${t.name}」の個人プロフィールページのテキストです。
プロフィール情報をJSONオブジェクトで返してください。余分なテキストは不要です。

フィールド:
- comment: 自己紹介・プロフィールコメント・店舗からの推薦文（単なる「ガチ恋注意」「つるすべ」等の短いキーワードタグ群ではなく、ページ下部にある「Comment / コメント」や店舗からの推薦文・自己紹介文などの詳細なコメント文章・メッセージ本文を優先して全文抽出してください。改行区切りの長文可、文字数制限なし、なければnull）

テキスト:
${pageText}`;

      const result = await model.generateContent(prompt);
      const rawText = result.response.text().trim();
      const match = rawText.match(/\{[\s\S]*?\}/);

      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.comment) {
          console.log(`✅ Updated ${t.name}:`, parsed.comment.slice(0, 40) + '...');
          await supabase.from('therapists').update({ comment: parsed.comment }).eq('id', t.id);
        }
      }
    } catch (e) {
      console.error(`Error processing ${t.name}:`, e.message);
    }
  }

  console.log('All SpecialGrade therapists re-processed with safety settings!');
}

run();
