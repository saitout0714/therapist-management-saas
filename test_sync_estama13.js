const { chromium } = require('playwright');
const fs = require('fs');

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Estama
    console.log('--- ESTAMA ---');
    await page.goto('https://estama.jp/login/?r=/admin/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"loginname\"], input[name=\"username\"], input[name=\"mail\"], input[name=\"email\"], input[type=\"text\"], input[type=\"email\"]').first().fill('cocoro.rinse@gmail.com');
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill('masa1234');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('button[type=\"submit\"], input[type=\"submit\"], form button, .login-btn, a[type=\"submit\"], a.send-post').first().click()
    ]);
    
    await page.goto('https://estama.jp/admin/cast/add/', { waitUntil: 'domcontentloaded' });
    
    const estamaInputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
            tag: el.tagName,
            type: el.type,
            name: el.name,
            id: el.id,
            class: el.className
        }));
    });
    fs.writeFileSync('estama_inputs.json', JSON.stringify(estamaInputs, null, 2));
    console.log('Saved Estama inputs.');

    // Esthe Ranking
    console.log('\n--- ESTHE RANKING ---');
    await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"loginname\"], input[name=\"username\"], input[name=\"login_id\"], input[type=\"text\"]').first().fill('cocororinse');
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill('Cocoro0701');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('form[action=\"/login/\"] button[type=\"submit\"], button[type=\"submit\"], input[type=\"submit\"], button:has-text(\"ログイン\"), input[value*=\"ログイン\"]').first().click()
    ]);
    
    await page.goto('https://www.esthe-ranking.jp/shop/therapist/add/', { waitUntil: 'domcontentloaded' });
    
    const erInputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
            tag: el.tagName,
            type: el.type,
            name: el.name,
            id: el.id,
            class: el.className
        }));
    });
    fs.writeFileSync('er_inputs.json', JSON.stringify(erInputs, null, 2));
    console.log('Saved ER inputs.');
    
    await browser.close();
}
run();
