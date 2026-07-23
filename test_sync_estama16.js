const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- ESTAMA ---');
    await page.goto('https://estama.jp/login/?r=/admin/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"loginname\"], input[name=\"username\"], input[name=\"mail\"], input[name=\"email\"], input[type=\"text\"], input[type=\"email\"]').first().fill('cocoro.rinse@gmail.com');
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill('masa1234');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('button[type=\"submit\"], input[type=\"submit\"], form button, .login-btn, a[type=\"submit\"], a.send-post').first().click()
    ]);
    
    await page.goto('https://estama.jp/admin/cast_edit/', { waitUntil: 'domcontentloaded' });
    console.log('Went to:', page.url());
    
    const inputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
            tag: el.tagName,
            type: el.type,
            name: el.name
        }));
    });
    console.log('Estama Inputs:', JSON.stringify(inputs.filter(i => i.type !== 'hidden').slice(0, 10), null, 2));
    
    // Check ER add URL
    console.log('--- ESTHE RANKING ---');
    await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"loginname\"], input[name=\"username\"], input[name=\"login_id\"], input[type=\"text\"]').first().fill('cocororinse');
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill('Cocoro0701');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('form[action=\"/login/\"] button[type=\"submit\"], button[type=\"submit\"], input[type=\"submit\"], button:has-text(\"ログイン\"), input[value*=\"ログイン\"]').first().click()
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
    console.log('ER Inputs:', JSON.stringify(erInputs.filter(i => i.type !== 'hidden').slice(0, 10), null, 2));
    
    await browser.close();
}
run();
