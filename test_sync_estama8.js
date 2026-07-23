const { chromium } = require('playwright');
async function run() {
    const loginId = 'cocoro.rinse@gmail.com';
    const password = '0368222384';
    
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto('https://estama.jp/login/?r=/admin/', { waitUntil: 'load', timeout: 15000 });

    const loginInput = page.locator('input[name=\"loginname\"], input[name=\"username\"], input[name=\"mail\"], input[name=\"email\"], input[type=\"text\"], input[type=\"email\"]').first();
    const passInput = page.locator('input[name=\"password\"], input[type=\"password\"]').first();

    await loginInput.fill(loginId);
    await passInput.fill(password);

    console.log('Submitting via JS...');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.evaluate(() => {
            const form = document.getElementById('form-login_shop') || document.querySelector('form');
            form.method = 'post';
            const base = document.getElementById('post_base') ? document.getElementById('post_base').value : 'post';
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = base;
            input.value = 'login_shop';
            form.appendChild(input);
            form.submit();
        })
    ]);
    
    console.log('URL after submit:', page.url());
    if (!page.url().includes('login')) {
      console.log('SUCCESS!');
    }
    
    await browser.close();
}
run();
