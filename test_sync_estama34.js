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
    
    await page.goto('https://www.esthe-ranking.jp/shop/image/girl/upload/all/', { waitUntil: 'domcontentloaded' });
    
    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.innerText.trim().replace(/\n/g, ' '),
            href: a.href
        })).filter(a => a.href.includes('girl'));
    });
    console.log('Girl links:', JSON.stringify(links.slice(0, 30), null, 2));

    await browser.close();
}
run();
