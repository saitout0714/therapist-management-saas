const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://static-v3.estama.jp/assets/admin/js/main.js', { waitUntil: 'load' });
    const content = await page.evaluate(() => document.body.innerText);
    const lines = content.split('\n');
    const idx = lines.findIndex(l => l.includes('.parents(\'form\')'));
    console.log('Surrounding lines:', lines.slice(Math.max(0, idx - 10), idx + 20).join('\n'));

    await browser.close();
}
run();
