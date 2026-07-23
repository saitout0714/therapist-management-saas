const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto('https://estama.jp/login/?r=/admin/');
    const forms = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('form')).map(f => ({
            id: f.id,
            action: f.action,
            method: f.method
        }));
    });
    console.log('Forms:', forms);
    
    await browser.close();
}
run();
