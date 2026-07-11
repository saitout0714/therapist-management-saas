function run() {
  const dateStr = '2026-07-02';
  
  // Simulated code inside scraper:
  const now = new Date();
  console.log('System local time:', now.toString());
  console.log('System ISO string:', now.toISOString());
  
  const today = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  console.log('today with +9h:', today.toString());
  console.log('today ISO string:', today.toISOString());
  
  const todayStr = today.toISOString().split('T')[0];
  console.log('todayStr (calculated):', todayStr);
  
  const diffTime = new Date(dateStr).getTime() - new Date(todayStr).getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const dayNum = diffDays + 1;
  
  console.log('dateStr:', dateStr);
  console.log('todayStr:', todayStr);
  console.log('diffDays:', diffDays);
  console.log('dayNum:', dayNum);
}

run();
