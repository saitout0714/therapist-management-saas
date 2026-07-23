const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- ESTHE RANKING ---');
    await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"loginname\"]').first().fill('cocororinse');
    await page.locator('input[name=\"password\"]').first().fill('Cocoro0701');
    
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('input[name=\"password\"]').first().press('Enter')
    ]);
    
    await page.goto('https://www.esthe-ranking.jp/shop/image/girl/upload/detail/', { waitUntil: 'domcontentloaded' });
    console.log('Went to:', page.url());
    
    const elements = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, select, textarea, button')).map(el => ({
            tag: el.tagName,
            type: el.type,
            name: el.name,
            value: el.value,
            text: (el.innerText || el.value || '').trim()
        }));
    });
    console.log('Inputs on /detail/:', JSON.stringify(elements.filter(i => i.type !== 'hidden').slice(0, 15), null, 2));

    await browser.close();
}
run();
