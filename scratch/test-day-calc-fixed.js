function test() {
  const dateStr = '2026-07-02';
  
  // Get JST today date string
  const todayStr = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date()).replace(/\//g, '-');
  
  console.log('JST todayStr:', todayStr);
  
  // Parse todayStr in local time to avoid UTC date boundaries shifting
  const parts = todayStr.split('-').map(Number);
  const parsedStart = new Date(parts[0], parts[1] - 1, parts[2]);
  
  let dayNum = null;
  for (let offset = 0; offset < 7; offset++) {
    const targetDt = new Date(parsedStart);
    targetDt.setDate(parsedStart.getDate() + offset);
    
    // Format targetDt back to YYYY-MM-DD
    const y = targetDt.getFullYear();
    const m = String(targetDt.getMonth() + 1).padStart(2, '0');
    const d = String(targetDt.getDate()).padStart(2, '0');
    const targetDateStr = `${y}-${m}-${d}`;
    
    if (targetDateStr === dateStr) {
      dayNum = offset + 1;
      break;
    }
  }
  
  console.log('Target dateStr:', dateStr);
  console.log('Computed dayNum:', dayNum);
}

test();
