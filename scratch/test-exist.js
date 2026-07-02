async function test() {
  const url = 'https://carezza.esthe-hp.com/item_10016422.html';
  console.log('Fetching', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body length:', text.length);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
