const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- ESTHE RANKING ---');
    await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"loginname\"], input[name=\"username\"], input[name=\"login_id\"], input[type=\"text\"]').first().fill('cocororinse');
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill('Cocoro0701');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('form').first().evaluate(f => f.submit())
    ]);
    
    await page.goto('https://www.esthe-ranking.jp/shop/therapist/add/', { waitUntil: 'domcontentloaded' });
    console.log('Went to ER:', page.url());
    
    const erInputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
            tag: el.tagName,
            type: el.type,
            name: el.name
        }));
    });
    console.log('ER Inputs:', JSON.stringify(erInputs.filter(i => i.type !== 'hidden').slice(0, 15), null, 2));
    
    await browser.close();
}
run();
