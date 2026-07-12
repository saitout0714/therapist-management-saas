const { chromium } = require('playwright');

async function run() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`PAGE CONSOLE ERROR: ${msg.text()}`);
    } else {
      console.log(`PAGE CONSOLE LOG: ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    console.log(`PAGE ERROR (uncaught exception): ${err.message}`);
  });

  console.log("Navigating to schedule page...");
  await page.goto('http://localhost:10016/schedule/');
  
  console.log("Waiting for widget to load (5 seconds)...");
  await page.waitForTimeout(5000);
  
  console.log("Fetching widget HTML...");
  const html = await page.evaluate(() => {
    const el = document.querySelector('.yoyakl-widget');
    return el ? el.innerHTML : 'Widget element not found';
  });
  console.log("--- Widget HTML ---");
  console.log(html);
  console.log("-------------------");
  
  await browser.close();
}
run().catch(err => console.error("Script exception:", err));
