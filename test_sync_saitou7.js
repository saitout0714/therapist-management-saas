const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://estama.jp/login/?r=/admin/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"mail\"], input[name=\"loginname\"], input[type=\"email\"], input[type=\"text\"]').first().fill('cocoro.rinse@gmail.com');
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill('masa1234');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('button[type=\"submit\"], input[type=\"submit\"], form button, .login-btn, a[type=\"submit\"], a.send-post').first().click()
    ]);
    
    await page.goto('https://estama.jp/admin/cast_edit/', { waitUntil: 'domcontentloaded' });
    await page.locator('input[name=\"name\"]').first().fill('âV“¡÷—æŽq');

    // Fetch admin_common.js
    const adminCommonJs = await page.evaluate(async () => {
        const scripts = Array.from(document.querySelectorAll('script')).map(s => s.src).filter(s => s.includes('admin_common'));
        if (scripts.length > 0) {
            const res = await fetch(scripts[0]);
            return await res.text();
        }
        return 'no script';
    });
    console.log('admin_common.js:', adminCommonJs.slice(0, 500));

    await browser.close();
}
run();
