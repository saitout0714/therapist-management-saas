const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function extractCommentFallback(html) {
  try {
    const match = html.match(/(?:Comment|コメント|自己紹介|お店からのコメント|店長コメント)[\s\S]*?(<div[\s\S]*?<\/div>|<p[\s\S]*?<\/p>)/i);
    if (match) {
      const text = match[0]
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^(?:Comment|コメント|自己紹介|お店からのコメント|店長コメント)\s*/i, '')
        .trim();
      if (text.length > 10) return text;
    }
  } catch (err) {
    // ignore
  }
  return null;
}

async function run() {
  const { data: shop } = await supabase.from('shops').select('id, name').eq('name', 'SpecialGrade').single();
  if (!shop) return;

  const { data: therapists } = await supabase
    .from('therapists')
    .select('id, name, hp_url, comment')
    .eq('shop_id', shop.id);

  for (const t of therapists) {
    if (!t.hp_url) continue;
    // If comment still contains tag keywords or is short
    if (!t.comment || t.comment.length < 30 || t.comment.includes('ガチ恋注意')) {
      console.log(`Fixing ${t.name} with regex fallback...`);
      try {
        const res = await fetch(t.hp_url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (!res.ok) continue;
        const html = await res.text();
        const extracted = extractCommentFallback(html);
        if (extracted) {
          console.log(`✅ Fixed ${t.name}:`, extracted.slice(0, 40) + '...');
          await supabase.from('therapists').update({ comment: extracted }).eq('id', t.id);
        } else {
          console.log(`❌ Could not extract for ${t.name}`);
        }
      } catch (err) {
        console.error(`Error fixing ${t.name}:`, err.message);
      }
    }
  }

  console.log('All remaining SpecialGrade therapists fixed!');
}

run();
