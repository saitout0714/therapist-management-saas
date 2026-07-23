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

    // Print all scripts or inline JS related to form submit
    const scriptSrcs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('script')).map(s => s.src || s.innerText.slice(0, 100));
    });
    console.log('Scripts:', scriptSrcs.filter(s => s.includes('submit') || s.includes('cast') || s.includes('common') || s.includes('admin')));

    // Let's submit the form by doing HTMLFormElement.prototype.submit.call(document.querySelector('form'))
    console.log('Submitting via native prototype submit...');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.evaluate(() => {
            const form = document.querySelector('form');
            HTMLFormElement.prototype.submit.call(form);
        })
    ]);

    console.log('URL after native submit:', page.url());

    await browser.close();
}
run();
