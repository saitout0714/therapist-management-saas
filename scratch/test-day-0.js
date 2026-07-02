const cheerio = require('cheerio');

async function test() {
  const url = 'https://carezza.esthe-hp.com/ajax/getdayscheduleitemlist/dayNum/0/nowPage/1/';
  console.log('Fetching', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    const html = await res.text();
    const $ = cheerio.load(`<div>${html}</div>`);
    const results = [];
    let currentRoom = '';
    $('div').first().children().each((_, el) => {
      const $el = $(el);
      if ($el.hasClass('courseTitle')) {
        currentRoom = $el.find('span').text().trim();
      } else if ($el.is('ul')) {
        $el.find('.scheduleData').each((_, li) => {
          const $li = $(li);
          const nameEl = $li.find('.itemName ruby');
          if (!nameEl.length) return;
          const rawName = nameEl.text().trim();
          let timeText = '';
          $li.find('.itmeTodaySchedule span').each((_, span) => {
            timeText += $(span).text().trim() + ' ';
          });
          timeText = timeText.trim();
          results.push({ name: rawName, time: timeText, room: currentRoom });
        });
      }
    });
    console.log('Parsed dayNum=0 results:', results);
  } catch (err) {
    console.error(err);
  }
}

test();
