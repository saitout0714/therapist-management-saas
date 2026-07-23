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
        page.locator('input[name=\"password\"], input[type=\"password\"]').first().press('Enter')
    ]);
    
    await page.goto('https://www.esthe-ranking.jp/shop/', { waitUntil: 'domcontentloaded' });
    console.log('Went to Shop:', page.url());
    
    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.innerText.trim(),
            href: a.href
        }));
    });
    console.log('Cast links:', links.filter(l => l.text.includes('キャスト') || l.text.includes('女の子') || l.text.includes('セラピスト')));
    
    await browser.close();
}
run();
