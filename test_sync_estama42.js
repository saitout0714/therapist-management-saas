const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- TEST ESTAMA SUBMIT CHECK ---');
    await page.goto('https://estama.jp/login/?r=/admin/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"mail\"], input[name=\"loginname\"], input[type=\"email\"], input[type=\"text\"]').first().fill('cocoro.rinse@gmail.com');
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill('masa1234');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('button[type=\"submit\"], input[type=\"submit\"], form button, .login-btn, a[type=\"submit\"], a.send-post').first().click()
    ]);
    
    await page.goto('https://estama.jp/admin/cast_edit/', { waitUntil: 'domcontentloaded' });
    
    await page.locator('input[name=\"name\"]').first().fill('テストテスト');

    const estamaSaveBtn = page.locator('a.btn-default_submit, a:has-text(\"保存する\"), a:has-text(\"保存\")').first();
    await estamaSaveBtn.click();
    await page.waitForTimeout(3000);

    console.log('After Click URL:', page.url());

    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('Errors / Messages:', bodyText.split('\n').filter(line => line.includes('エラー') || line.includes('必須') || line.includes('完了') || line.includes('保存') || line.includes('登録')).slice(0, 10));

    await browser.close();
}
run();
