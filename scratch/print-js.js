async function test() {
  const url = 'https://carezza.esthe-hp.com/scheduleAll.html';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    const html = await res.text();
    const lines = html.split('\n');
    
    // Print lines around 830 to 920
    for (let i = 790; i < 940; i++) {
      if (lines[i]) {
        console.log(`${i + 1}: ${lines[i].trim()}`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

test();
