async function test() {
  const url = 'https://carezza.esthe-hp.com/item_10038893.html';
  console.log('Fetching', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,en;q=0.9',
      }
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body length:', text.length);
    
    // Find all images (src, data-src)
    const imgs = [];
    const patterns = [
      /\b(?:src|data-src|data-original|data-lazy|data-img)=["']([^"']+)["']/gi,
      /srcset=["']([^"']+)["']/gi,
    ];
    for (const pattern of patterns) {
      for (const m of text.matchAll(pattern)) {
        const raw = m[1].split(',')[0].trim().split(/\s+/)[0];
        imgs.push(raw);
      }
    }
    console.log('All image sources found:', [...new Set(imgs)]);
    
    // Search for a specific section that has the therapist image
    // Typically under something like "cast_photo" or "item-image" or similar
    console.log('Search for keywords:');
    const lines = text.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('itemPhoto') || line.includes('photo') || line.includes('10038893')) {
        console.log(`Line ${idx + 1}: ${line.trim().slice(0, 200)}`);
      }
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
