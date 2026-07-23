const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Check ER add URL
    console.log('--- ESTHE RANKING ---');
    await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"loginname\"], input[name=\"username\"], input[name=\"login_id\"], input[type=\"text\"]').first().fill('cocororinse');
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill('Cocoro0701');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('form').first().evaluate(f => f.submit())
    ]);
    
    await page.goto('https://www.esthe-ranking.jp/shop/therapist/add/', { waitUntil: 'domcontentloaded' });
    console.log('Went to ER:', page.url());
    
    const erNameInput = page.locator('input[name=\"name\"], input[name=\"cast_name\"], input[name=\"nick_name\"]').first();
    await erNameInput.fill('テストセラピスト');

    const erSaveButton = page.locator('.btn-primary, button:has-text(\"保存\"), button:has-text(\"登録\"), button[type=\"submit\"], input[type=\"submit\"]').first();
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        erSaveButton.click({ force: true, timeout: 5000 }).catch(() => page.evaluate(() => {
          const forms = Array.from(document.querySelectorAll('form'));
          const targetForm = forms.find(f => f.innerText.includes('保存') || f.innerText.includes('登録') || f.action.includes('add') || f.action.includes('edit')) || forms[forms.length - 1];
          if (targetForm) targetForm.submit();
        }))
    ]);

    console.log('ER After Save URL:', page.url());
    const erHTML = await page.content();
    console.log('Has error?', erHTML.includes('エラー') || !!erHTML.match(/class=\"[^\"]*error[^\"]*\"/));
    
    await browser.close();
}
run();
