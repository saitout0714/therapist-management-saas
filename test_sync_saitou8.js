const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://static-v3.estama.jp/assets/admin/js/admin_common.js', { waitUntil: 'load' });
    const content = await page.evaluate(() => document.body.innerText);
    console.log('admin_common.js content:', content.slice(0, 1500));

    await browser.close();
}
run();
