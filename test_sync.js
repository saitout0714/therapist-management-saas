const { chromium } = require('playwright');
const fs = require('fs');

async function testEstama() {
  const loginId = 'cocoro.rinse@gmail.com';
  const password = '0368222384';
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('Testing Estama Login...');
    await page.goto('https://estama.jp/login/?r=/admin/');
    
    await page.locator('input[name=\"login_id\"], input[name=\"loginname\"], input[name=\"username\"], input[name=\"mail\"], input[name=\"email\"], input[type=\"text\"], input[type=\"email\"]').first().fill(loginId, { timeout: 10000 });
    await page.locator('input[name=\"login_pass\"], input[name=\"password\"], input[type=\"password\"]').first().fill(password, { timeout: 10000 });
    
    const submitButton = page.locator('button[type=\"submit\"], input[type=\"submit\"], .login_btn, button:has-text(\"ログイン\"), input[value*=\"ログイン\"], a.send-post, a[type=\"submit\"]').first();
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      submitButton.click({ timeout: 5000 }).catch(() => page.keyboard.press('Enter'))
    ]);

    await page.goto('https://estama.jp/admin/cast/add/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    
    if (page.url().includes('/login')) {
      throw new Error('Estama login failed!');
    }
    console.log('Estama SUCCESS!');

  } catch (e) {
    console.error('Estama Error:', e);
  } finally {
    if (browser) await browser.close();
  }
}

(async () => {
  await testEstama();
})();
