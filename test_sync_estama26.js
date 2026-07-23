const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- ESTHE RANKING ---');
    await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"loginname\"]').first().fill('cocororinse');
    await page.locator('input[name=\"password\"]').first().fill('Cocoro0701');
    
    // Login by pressing Enter on password field
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('input[name=\"password\"]').first().press('Enter')
    ]);
    
    console.log('Dashboard URL:', page.url());
    
    await page.goto('https://www.esthe-ranking.jp/shop/therapist/add/', { waitUntil: 'domcontentloaded' }).catch(()=>{});
    console.log('Add Cast URL:', page.url());

    const erInputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
            name: el.name,
            type: el.type
        }));
    });
    console.log('ER Inputs:', JSON.stringify(erInputs.filter(i => i.type !== 'hidden').slice(0, 15), null, 2));

    await browser.close();
}
run();
