const { chromium } = require('playwright');
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
    
    await page.goto('https://estama.jp/admin/cast/add/', { waitUntil: 'domcontentloaded' }).catch(()=>{});
    console.log('Add URL:', page.url());

    // fill minimal form
    const nameInput = page.locator('input[name=\"name\"], input[name=\"cast_name\"], input[name=\"nick_name\"]').first();
    await nameInput.fill('テストセラピスト');

    await page.screenshot({ path: 'estama_before_save.png' });
    
    const saveButton = page.locator('.save-btn, button:has-text(\"保存\"), button:has-text(\"登録\"), button[type=\"submit\"], input[type=\"submit\"]').first();
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        saveButton.click({ force: true, timeout: 5000 }).catch(() => page.evaluate(() => {
          const forms = Array.from(document.querySelectorAll('form'));
          const targetForm = forms.find(f => f.innerText.includes('保存') || f.innerText.includes('登録') || f.action.includes('add') || f.action.includes('edit')) || forms[forms.length - 1];
          if (targetForm) targetForm.submit();
        }))
    ]);

    console.log('Estama After Save URL:', page.url());
    await page.screenshot({ path: 'estama_after_save.png' });
    const eHTML = await page.content();
    console.log('Has error?', eHTML.includes('エラー') || !!eHTML.match(/class=\"[^\"]*error[^\"]*\"/));

    // Esthe Ranking
    console.log('\n--- ESTHE RANKING ---');
    await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"loginname\"], input[name=\"username\"], input[name=\"login_id\"], input[type=\"text\"]').first().fill('cocororinse');
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill('Cocoro0701');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('form[action=\"/login/\"] button[type=\"submit\"], button[type=\"submit\"], input[type=\"submit\"], button:has-text(\"ログイン\"), input[value*=\"ログイン\"]').first().click()
    ]);
    
    await page.goto('https://www.esthe-ranking.jp/shop/therapist/add/', { waitUntil: 'domcontentloaded' }).catch(()=>{});
    console.log('Add URL:', page.url());

    const erNameInput = page.locator('input[name=\"name\"], input[name=\"cast_name\"], input[name=\"nick_name\"]').first();
    await erNameInput.fill('テストセラピスト');

    await page.screenshot({ path: 'er_before_save.png' });

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
    await page.screenshot({ path: 'er_after_save.png' });
    const erHTML = await page.content();
    console.log('Has error?', erHTML.includes('エラー') || !!erHTML.match(/class=\"[^\"]*error[^\"]*\"/));
    
    await browser.close();
}
run();
