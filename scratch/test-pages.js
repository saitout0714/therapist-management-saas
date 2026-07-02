const cheerio = require('cheerio');

async function test() {
  for (let page = 1; page <= 3; page++) {
    const url = `https://carezza.esthe-hp.com/ajax/getdayscheduleitemlist/dayNum/1/nowPage/${page}/`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      });
      const html = await res.text();
      const $ = cheerio.load(html);
      const names = [];
      $('.scheduleData').each((_, el) => {
        names.push($(el).find('.itemName ruby').text().trim());
      });
      console.log(`Page ${page} names:`, names);
    } catch (err) {
      console.error(err);
    }
  }
}

test();
