const cheerio = require('cheerio');

async function test() {
  const url = 'https://carezza.esthe-hp.com/scheduleAll.html';
  console.log('Fetching', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    $('#scheduleDateList ul li').each((i, el) => {
      const dayId = $(el).attr('data-day');
      const month = $(el).find('.month').text().trim();
      const day = $(el).find('.day').text().trim();
      const dayOfWeek = $(el).find('.dayOfWeekWrap').text().trim();
      console.log(`Index ${i}: data-day="${dayId}", month="${month}", day="${day}", dayOfWeek="${dayOfWeek}"`);
    });
  } catch (err) {
    console.error(err);
  }
}

test();
