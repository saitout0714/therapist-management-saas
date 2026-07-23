const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- TEST ER LOGIN ---');
    await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.fill('input[name=\"loginname\"]', 'cocororinse');
    await page.fill('input[name=\"password\"]', 'Cocoro0701');
    
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => console.log('nav catch:', e.message)),
        page.click('form[action=\"/login/\"] button[type=\"submit\"]')
    ]);
    
    console.log('URL after login submit:', page.url());
    
    await page.goto('https://www.esthe-ranking.jp/shop/image/girl/upload/detail/new/', { waitUntil: 'domcontentloaded' }).catch(e => console.log('goto catch:', e.message));
    console.log('URL after goto edit:', page.url());

    await browser.close();
}
run();
