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
    
    console.log('Dashboard URL:', page.url());
    
    await page.goto('https://www.esthe-ranking.jp/shop/image/girl/upload/all/', { waitUntil: 'domcontentloaded' });
    console.log('Therapist list URL:', page.url());

    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.innerText.trim().replace(/\n/g, ' '),
            href: a.href
        })).filter(a => a.text.includes('“o˜^') || a.text.includes('’Ç‰Á') || a.href.includes('add') || a.href.includes('edit'));
    });
    console.log('Action links:', links);

    await browser.close();
}
run();
