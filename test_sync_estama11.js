const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Estama
    await page.goto('https://estama.jp/login/?r=/admin/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"loginname\"], input[name=\"username\"], input[name=\"mail\"], input[name=\"email\"], input[type=\"text\"], input[type=\"email\"]').first().fill('cocoro.rinse@gmail.com');
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill('masa1234');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('button[type=\"submit\"], input[type=\"submit\"], form button, .login-btn, a[type=\"submit\"], a.send-post').first().click()
    ]);
    await page.goto('https://estama.jp/admin/cast/add/', { waitUntil: 'domcontentloaded' }).catch(()=>{});
    
    const estamaButtons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button[type=\"submit\"], input[type=\"submit\"], a.send-post')).map(b => ({
            tag: b.tagName,
            type: b.type,
            class: b.className,
            text: b.innerText || b.value
        }));
    });
    console.log('Estama submit buttons:', estamaButtons);

    // Esthe Ranking
    await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"loginname\"], input[name=\"username\"], input[name=\"login_id\"], input[type=\"text\"]').first().fill('cocororinse');
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill('Cocoro0701');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('form[action=\"/login/\"] button[type=\"submit\"], button[type=\"submit\"], input[type=\"submit\"], button:has-text(\"ログイン\"), input[value*=\"ログイン\"]').first().click()
    ]);
    await page.goto('https://www.esthe-ranking.jp/shop/therapist/add/', { waitUntil: 'domcontentloaded' }).catch(()=>{});
    
    const erButtons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button[type=\"submit\"], input[type=\"submit\"], a.send-post')).map(b => ({
            tag: b.tagName,
            type: b.type,
            class: b.className,
            text: b.innerText || b.value
        }));
    });
    console.log('ER submit buttons:', erButtons);
    
    await browser.close();
}
run();
