const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- ESTHE RANKING EXISTING GIRL DETAIL ---');
    await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'load', timeout: 15000 });
    await page.fill('input[name=\"loginname\"]', 'cocororinse');
    await page.fill('input[name=\"password\"]', 'Cocoro0701');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.click('form[action=\"/login/\"] button[type=\"submit\"]')
    ]);
    
    await page.goto('https://www.esthe-ranking.jp/shop/image/girl/upload/detail/1700960/', { waitUntil: 'domcontentloaded' });
    const erFiles = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, form, a, button')).map(i => ({
            tag: i.tagName,
            type: i.type,
            name: i.name,
            id: i.id,
            className: i.className,
            text: (i.innerText || i.value || '').trim()
        })).filter(i => i.type === 'file' || i.text.includes('âÊëú') || i.text.includes('é ê^') || i.href?.includes('upload') || i.action?.includes('upload'));
    });
    console.log('ER Photo Elements:', erFiles);

    await browser.close();
}
run();
