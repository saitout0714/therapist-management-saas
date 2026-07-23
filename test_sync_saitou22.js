const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- TEST SAVE WITHOUT WAIT FOR NAV ---');
    await page.goto('https://estama.jp/login/?r=/admin/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"mail\"], input[name=\"loginname\"], input[type=\"email\"], input[type=\"text\"]').first().fill('cocoro.rinse@gmail.com');
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill('masa1234');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('button[type=\"submit\"], input[type=\"submit\"], form button, .login-btn, a[type=\"submit\"], a.send-post').first().click()
    ]);
    
    await page.goto('https://estama.jp/admin/cast_edit/', { waitUntil: 'domcontentloaded' });
    await page.locator('input[name=\"name\"]').first().fill('âV“¡÷—æŽq');

    // Click btn-default_submit
    const saveBtn = page.locator('a.btn-default_submit').first();
    await saveBtn.click();
    console.log('Clicked save button...');

    await page.waitForTimeout(5000);
    console.log('URL after 5s:', page.url());

    // Check cast list!
    await page.goto('https://estama.jp/admin/cast/', { waitUntil: 'domcontentloaded' });
    const casts = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href*=\"/cast_edit/\"]')).map(a => ({
            text: a.innerText.trim(),
            href: a.href
        }));
    });
    console.log('Latest Casts in list:', casts.slice(0, 5));

    await browser.close();
}
run();
