const cheerio = require('cheerio');

function parseTime(text) {
  const m = text.match(/(\d{1,2}:\d{2})\s*[～~\-]\s*(LAST|\d{1,2}:\d{2})/i)
  if (!m) return null
  
  const start = m[1]
  const endRaw = m[2].toUpperCase()
  const [sh, sm] = start.split(':')
  
  let end = ''
  if (endRaw === 'LAST') {
    end = '29:00'
  } else {
    const [eh, em] = endRaw.split(':')
    end = `${String(parseInt(eh, 10)).padStart(2, '0')}:${em}`
  }
  
  return [`${String(parseInt(sh, 10)).padStart(2, '0')}:${sm}`, end]
}

async function test() {
  const url = 'https://carezza.esthe-hp.com/ajax/getdayscheduleitemlist/dayNum/1/nowPage/1/';
  console.log('Fetching', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    const html = await res.text();
    // Load as a full document or wrap it in a root element so children() works
    const $ = cheerio.load(`<div>${html}</div>`);
    const results = [];
    let currentRoom = '';
    
    // Iterate over children of the wrapper div
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
          
          const timeRes = parseTime(timeText);
          if (!timeRes) return;
          const [start, end] = timeRes;
          
          results.push({ name: rawName, start, end, room: currentRoom });
        });
      }
    });
    
    console.log('Parsed results:', results);
  } catch (err) {
    console.error(err);
  }
}

test();
