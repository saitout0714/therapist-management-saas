async function test() {
  const url = 'https://carezza.esthe-hp.com/itemList.html';
  console.log('Fetching', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,en;q=0.9',
      }
    });
    const text = await res.text();
    
    // Let's find links containing "item_" and their context text (like therapist names)
    // We can use a regex to look at the HTML structure around href="/item_xxxx.html"
    const regex = /<a[^>]+href=["'](\/item_[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const matches = [...text.matchAll(regex)];
    console.log(`Found ${matches.length} therapist links:`);
    
    const therapists = [];
    for (const m of matches) {
      const link = m[1];
      const inner = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      therapists.push({ link, inner });
    }
    console.log(JSON.stringify(therapists, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
