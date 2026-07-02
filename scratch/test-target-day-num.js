const cheerio = require('cheerio');

async function test() {
  const url = 'https://carezza.esthe-hp.com/scheduleAll.html';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    console.log('HTML of first li:', $('#scheduleDateList ul li').first().html());
  } catch (err) {
    console.error(err);
  }
}

test();
