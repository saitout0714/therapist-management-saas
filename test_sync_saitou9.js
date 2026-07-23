const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://static-v3.estama.jp/assets/admin/js/admin_common.js', { waitUntil: 'load' });
    const content = await page.evaluate(() => document.body.innerText);
    const lines = content.split('\n').filter(l => l.includes('submit') || l.includes('btn-default') || l.includes('form'));
    console.log('Matching lines in admin_common.js:', lines);

    await browser.close();
}
run();
