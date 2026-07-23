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
    
    // Fill all possible inputs
    await page.locator('input[name=\"name\"]').first().fill('âV“¡÷—æŽq');

    // Check all checkboxes of type[] or similar
    const checkboxes = page.locator('input[type=\"checkbox\"]');
    const count = await checkboxes.count();
    console.log('Checkboxes count:', count);
    if (count > 0) {
        await checkboxes.first().check();
    }

    // Submit form by triggering jQuery submit OR evaluating submit
    const navPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => console.log('Nav:', e.message));
    
    await page.evaluate(() => {
        document.querySelector('form').submit();
    });

    await navPromise;

    console.log('URL after form submit:', page.url());

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
