async function test() {
  const url = 'https://carezza.esthe-hp.com/scheduleAll.html';
  console.log('Fetching', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    console.log('Status:', res.status);
    const html = await res.text();
    console.log('Body length:', html.length);
    
    // Look for schedule containers, tables, dates, and therapist names
    const lines = html.split('\n');
    console.log('Snippet around schedule headers or boxes:');
    
    // Let's print sections containing schedule elements
    // E.g., looking for table, class="sche", class="schedule", date, therapist, etc.
    let count = 0;
    lines.forEach((line, idx) => {
      if (line.includes('sche') || line.includes('schedule') || line.includes('出勤') || line.includes('calendar') || line.includes('item_100')) {
        if (count < 60) {
          console.log(`Line ${idx + 1}: ${line.trim().slice(0, 150)}`);
          count++;
        }
      }
    });
  } catch (err) {
    console.error(err);
  }
}

test();
