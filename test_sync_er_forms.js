const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- TEST ER FORMS ---');
    await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'load', timeout: 15000 });
    await page.fill('input[name=\"loginname\"]', 'cocororinse');
    await page.fill('input[name=\"password\"]', 'Cocoro0701');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.click('form[action=\"/login/\"] button[type=\"submit\"]')
    ]);
    
    await page.goto('https://www.esthe-ranking.jp/shop/image/girl/upload/detail/1700960/', { waitUntil: 'domcontentloaded' });

    const forms = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('form')).map(f => ({
            action: f.action,
            method: f.method,
            enctype: f.enctype,
            inputs: Array.from(f.querySelectorAll('input')).map(i => ({ type: i.type, name: i.name })),
            buttons: Array.from(f.querySelectorAll('button, input[type=\"submit\"]')).map(b => ({ tag: b.tagName, type: b.type, text: (b.innerText || b.value || '').trim() }))
        }));
    });
    console.log('ER Forms:', JSON.stringify(forms, null, 2));

    await browser.close();
}
run();
