const { chromium } = require('playwright');

async function testEstama() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    await page.goto('https://estama.jp/login/?r=/admin/');
    await page.locator('input[name=\"loginname\"], input[name=\"mail\"], input[name=\"login_id\"]').first().fill('cocoro.rinse@gmail.com');
    await page.locator('input[name=\"password\"], input[name=\"login_pass\"]').first().fill('0368222384');

    const submitButton = page.locator('button[type=\"submit\"], a.send-post, input[type=\"submit\"], .login-btn').first();
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      submitButton.click()
    ]);
    
    await page.waitForTimeout(2000);
    console.log('Current URL:', page.url());
    
    // go to cast
    await page.goto('https://estama.jp/admin/cast/', { waitUntil: 'domcontentloaded' }).catch(()=>{});
    console.log('After goto cast:', page.url());

  } catch (e) {
    console.error('Estama Error:', e);
  } finally {
    if (browser) await browser.close();
  }
}
testEstama();
