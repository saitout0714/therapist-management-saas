const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,en;q=0.9'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// m-a-s-u-o.sakura.ne.jp プラットフォームの /profile?id= パターンのパーサー
function parseMasuoPlatform(html, baseUrl) {
  const results = [];
  // <a href="/profile?id=XX"> 内のすべての情報を取得
  const aPattern = /<a\s+href="(\/profile\?id=\d+)">([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = aPattern.exec(html)) !== null) {
    const href = m[1];
    const inner = m[2];
    const profileUrl = new URL(href, baseUrl).toString();

    // 名前と年齢（h3タグ内）
    const h3Match = inner.match(/<h3>([^<(（]+)[（(](\d+)[)）]?.*?<\/h3>/);
    if (!h3Match) continue;
    const name = h3Match[1].trim();
    const age = parseInt(h3Match[2], 10);

    // 写真URL
    const imgMatch = inner.match(/data-p1="([^"]+)"/);
    const photoUrl = imgMatch ? imgMatch[1].split('?')[0] : null;

    // スペック（T/B/W/H）
    const bodyMatch = inner.match(/T(\d+)\s+B(\d+)\(([A-K])\)\s+W(\d+)\s+H(\d+)/);
    let height = null, bust = null, bustCup = null, waist = null, hip = null;
    if (bodyMatch) {
      height = parseInt(bodyMatch[1]);
      bust = parseInt(bodyMatch[2]);
      bustCup = bodyMatch[3];
      waist = parseInt(bodyMatch[4]);
      hip = parseInt(bodyMatch[5]);
    }

    results.push({ name, age, height, bust, bust_cup: bustCup, waist, hip, profile_url: profileUrl, photo_url: photoUrl });
  }
  return results;
}

async function run() {
  const html = await fetchUrl('https://www.the-spa.tokyo/cast/');
  const results = parseMasuoPlatform(html, 'https://www.the-spa.tokyo');
  console.log('Parsed therapists:', JSON.stringify(results, null, 2));
}

run().catch(console.error);
