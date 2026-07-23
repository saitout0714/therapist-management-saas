const { chromium } = require('playwright');
async function run() {
    const loginId = 'cocoro.rinse@gmail.com';
    const password = 'masa1234';
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://estama.jp/login/?r=/admin/', { waitUntil: 'domcontentloaded', timeout: 15000 });

    const loginInput = page.locator('input[name=\"loginname\"], input[name=\"username\"], input[name=\"mail\"], input[name=\"email\"], input[type=\"text\"], input[type=\"email\"]').first();
    const passInput = page.locator('input[name=\"password\"], input[type=\"password\"]').first();

    await loginInput.fill(loginId);
    await passInput.fill(password);

    console.log('Clicking...');
    const submitButton = page.locator('button[type=\"submit\"], input[type=\"submit\"], form button, .login-btn, a[type=\"submit\"], a.send-post').first();
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        submitButton.click()
    ]);
    
    console.log('URL after submit:', page.url());
    if (!page.url().includes('login')) {
      console.log('SUCCESS!');
    }
    
    await browser.close();
}
run();
