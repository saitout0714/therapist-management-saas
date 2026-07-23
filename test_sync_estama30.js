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
    
    const elements = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, button, a')).map(el => ({
            tag: el.tagName,
            type: el.type,
            name: el.name,
            value: el.value,
            text: el.innerText ? el.innerText.trim() : '',
            href: el.href || ''
        })).filter(el => el.text.includes('“o˜^') || el.text.includes('’Ç‰Á') || el.value?.includes('“o˜^') || el.value?.includes('’Ç‰Á') || el.href.includes('therapist') || el.href.includes('girl'));
    });
    console.log('Action elements:', elements);

    await browser.close();
}
run();
