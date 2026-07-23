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

    // Query jQuery events on btn-default_submit
    const eventDetails = await page.evaluate(() => {
        const btn = document.querySelector('.btn-default_submit');
        if (!btn || typeof $ === 'undefined') return 'jQuery or btn missing';

        const events = $._data(btn, 'events') || $._data(document, 'events');
        if (!events) return 'no events found';

        return Object.keys(events);
    });
    console.log('Events on btn-default_submit or document:', eventDetails);

    // Let's trigger click via jQuery
    await page.evaluate(() => {
        .btn-default_submit.trigger('click');
    });
    await page.waitForTimeout(3000);
    console.log('URL after jQuery trigger click:', page.url());

    await browser.close();
}
run();
