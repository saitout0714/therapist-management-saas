const cheerio = require('cheerio');

async function getDaySchedule(dayNum) {
  const url = `https://carezza.esthe-hp.com/ajax/getdayscheduleitemlist/dayNum/${dayNum}/nowPage/1/`;
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
  return results;
}

async function run() {
  // Fetch main schedule HTML to see the dates mapping
  const res = await fetch('https://carezza.esthe-hp.com/scheduleAll.html', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const dates = [];
  $('#scheduleDateList ul li').each((i, el) => {
    const dayId = $(el).attr('data-day');
    const dayNumText = dayId.replace('day', '');
    const day = $(el).find('.day').text().trim();
    const dayOfWeek = $(el).find('.dayOfWeekWrap').text().trim();
    dates.push({ dayNum: parseInt(dayNumText, 10), dateText: `${day} (${dayOfWeek})` });
  });

  console.log('Dates on website:', dates);

  for (const d of dates) {
    const schedule = await getDaySchedule(d.dayNum);
    console.log(`\nSchedule for dayNum=${d.dayNum} [Date: ${d.dateText}]:`);
    console.log(JSON.stringify(schedule, null, 2));
  }
}

run();
