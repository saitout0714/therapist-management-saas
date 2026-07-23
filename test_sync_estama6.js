const { chromium } = require('playwright');
async function run() {
    const loginId = 'cocoro.rinse@gmail.com';
    const password = '0368222384';
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://estama.jp/login/?r=/admin/', { waitUntil: 'domcontentloaded', timeout: 15000 });

    const loginInput = page.locator('input[name=\"loginname\"], input[name=\"username\"], input[name=\"mail\"], input[name=\"email\"], input[type=\"text\"], input[type=\"email\"]').first();
    const passInput = page.locator('input[name=\"password\"], input[type=\"password\"]').first();

    await loginInput.fill(loginId);
    await passInput.fill(password);

    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        passInput.press('Enter')
    ]);
    
    console.log('URL after enter:', page.url());

    if (page.url().includes('login')) {
      console.log('Trying form submit...');
      await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
          page.evaluate(() => document.querySelector('form').submit())
      ]);
      console.log('URL after form submit:', page.url());
    }
    
    await browser.close();
}
run();
