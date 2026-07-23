const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- TEST ESTAMA ---');
    await page.goto('https://estama.jp/login/?r=/admin/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"mail\"], input[name=\"loginname\"], input[type=\"email\"], input[type=\"text\"]').first().fill('cocoro.rinse@gmail.com');
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill('masa1234');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('button[type=\"submit\"], input[type=\"submit\"], form button, .login-btn, a[type=\"submit\"], a.send-post').first().click()
    ]);
    
    await page.goto('https://estama.jp/admin/cast_edit/', { waitUntil: 'domcontentloaded' });
    console.log('Estama Edit URL:', page.url());
    
    // Fill Estama name
    await page.locator('input[name=\"name\"]').first().fill('テスト花子');
    console.log('Estama name filled!');

    const estamaSaveBtn = page.locator('a.btn-default_submit, a:has-text(\"保存\"), button:has-text(\"保存\")').first();
    console.log('Estama Save button found:', await estamaSaveBtn.innerText().catch(() => 'none'));

    console.log('--- TEST ESTHE RANKING ---');
    await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'load', timeout: 15000 });
    await page.fill('input[name=\"loginname\"]', 'cocororinse');
    await page.fill('input[name=\"password\"]', 'Cocoro0701');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.click('form[action=\"/login/\"] button[type=\"submit\"]')
    ]);
    
    await page.goto('https://www.esthe-ranking.jp/shop/image/girl/upload/detail/new/', { waitUntil: 'domcontentloaded' });
    console.log('ER Edit URL:', page.url());

    await page.locator('input[name=\"nickname\"]').first().fill('テスト花子');
    console.log('ER nickname filled!');

    const erSaveBtn = page.locator('button:has-text(\"この内容で保存\"), button:has-text(\"保存\")').first();
    console.log('ER Save button found:', await erSaveBtn.innerText().catch(() => 'none'));

    await browser.close();
}
run();
