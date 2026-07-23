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
    
    const scripts = await page.evaluate(async () => {
        const urls = Array.from(document.querySelectorAll('script')).map(s => s.src).filter(Boolean);
        const results = [];
        for (const u of urls) {
            try {
                const res = await fetch(u);
                const text = await res.text();
                if (text.includes('btn-default_submit')) {
                    results.push({ url: u, text: text.slice(text.indexOf('btn-default_submit') - 100, text.indexOf('btn-default_submit') + 200) });
                }
            } catch (e) {}
        }
        return results;
    });
    console.log('Scripts containing btn-default_submit:', JSON.stringify(scripts, null, 2));

    await browser.close();
}
run();
