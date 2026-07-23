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

    await page.goto('https://estama.jp/login/?r=/admin/');
    console.log('Login URL loaded.');
    
    await page.locator('input[name=\"login_id\"], input[name=\"loginname\"], input[name=\"username\"], input[name=\"mail\"], input[name=\"email\"], input[type=\"text\"], input[type=\"email\"]').first().fill(loginId, { timeout: 10000 });
    await page.locator('input[name=\"login_pass\"], input[name=\"password\"], input[type=\"password\"]').first().fill(password, { timeout: 10000 });
    console.log('Filled credentials.');

    const submitButton = page.locator('button[type=\"submit\"], input[type=\"submit\"], .login_btn, button:has-text(\"ログイン\"), input[value*=\"ログイン\"], a.send-post, a[type=\"submit\"]').first();
    console.log('Submit button count:', await submitButton.count());
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      submitButton.click({ timeout: 5000 })
    ]);
    console.log('Clicked submit button.');
    
    await page.waitForTimeout(3000);
    console.log('Current URL after wait:', page.url());

    const errorMsg = await page.locator('.alert-danger, .error-message, .error, .validation-error').first();
    if (await errorMsg.count() > 0) {
        console.log('Error message on page:', await errorMsg.textContent());
    }

  } catch (e) {
    console.error('Estama Error:', e);
  } finally {
    if (browser) await browser.close();
  }
}

(async () => {
  await testEstama();
})();
