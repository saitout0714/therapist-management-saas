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

    // Find all event listeners or JS defining btn-default_submit
    const jsInfo = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        return scripts.map(s => s.innerText).filter(t => t.includes('btn-default_submit') || t.includes('submit'));
    });
    console.log('Inline Scripts with submit:', jsInfo);

    // Let's check jQuery click handler for btn-default_submit
    const jquerySubmitHandler = await page.evaluate(() => {
        const btn = document.querySelector('.btn-default_submit');
        if (!btn) return 'btn not found';
        
        // Let's test if trigger('click') via jQuery submits form
        if (typeof $ !== 'undefined') {
            const form = .closest('form');
            form.submit();
            return 'jQuery form.submit() called';
        }
        return 'jQuery not defined';
    });
    console.log('jQuery submit handler:', jquerySubmitHandler);
    
    await page.waitForTimeout(3000);
    console.log('URL after jQuery submit:', page.url());

    await browser.close();
}
run();
