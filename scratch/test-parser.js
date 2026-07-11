function resolveUrl(base, relative) {
  try { return new URL(relative, base).toString() } catch { return '' }
}

function parseEstheHp(html, baseUrl) {
  const results = [];
  // Match links like /item_10024583.html
  const pattern = /<a[^>]+href=["']([^"']*(?:item_\d+\.html|\/item\/\d+))["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set();
  
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const href = match[1];
    const innerHtml = match[2];
    
    const profileUrl = resolveUrl(baseUrl, href);
    if (!profileUrl || seen.has(profileUrl)) continue;
    
    const text = innerHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    
    const nameMatch = text.match(/^([^\(（\s]+)(?:\s*[\(（](\d+)(?:歳)?[\)）])?/);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      const age = nameMatch[2] ? parseInt(nameMatch[2], 10) : null;
      
      if (!name || name.length <= 1 || name.length > 10) continue;
      if (/トップ|出勤|料金|案内|システム|予約|求人|アクセス|ブログ|日記|掲示板/i.test(name)) continue;
      
      seen.add(profileUrl);
      results.push({
        name,
        age,
        profile_url: profileUrl,
      });
    }
  }
  return results;
}

async function test() {
  const url = 'https://carezza.esthe-hp.com/itemList.html';
  console.log('Fetching', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    const html = await res.text();
    const parsed = parseEstheHp(html, url);
    console.log(`Parsed ${parsed.length} therapists:`);
    console.log(JSON.stringify(parsed, null, 2));
  } catch (err) {
    console.error(err);
  }
}

test();
