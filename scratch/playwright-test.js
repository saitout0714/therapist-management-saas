const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to login page...');
    await page.goto('https://www.esthe-ranking.jp/login/');
    
    console.log('Filling credentials...');
    
    await page.fill('#loginname', 'cocororinse');
    await page.fill('#password', 'Cocoro0701');
    
    console.log('Submitting...');
    await page.click('form[action="/login/"] button[type="submit"]');
    
    console.log('Waiting for load state...');
    await page.waitForLoadState('networkidle');
    
    const htmlAfterLogin = await page.content();
    fs.writeFileSync('scratch/dashboard.html', htmlAfterLogin);
    console.log('Saved dashboard HTML to scratch/dashboard.html');

    // Attempt to take a screenshot
    await page.screenshot({ path: 'scratch/dashboard.png', fullPage: true });

    // Look for schedule link
    const scheduleLinks = await page.$$eval('a', as => as.map(a => ({ text: a.textContent?.trim(), href: a.href })).filter(a => a.text?.includes('出勤')));
    console.log('Found schedule links:', scheduleLinks);

    if (scheduleLinks.length > 0) {
      await page.goto(scheduleLinks[0].href);
      await page.waitForLoadState('networkidle');
      const scheduleHtml = await page.content();
      fs.writeFileSync('scratch/schedule.html', scheduleHtml);
      await page.screenshot({ path: 'scratch/schedule.png', fullPage: true });
      console.log('Saved schedule HTML and screenshot.');
    } else {
      console.log('No schedule links found. Check scratch/dashboard.png for login result.');
    }

  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close();
  }
})();
