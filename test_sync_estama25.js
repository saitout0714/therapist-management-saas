const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- ESTHE RANKING ---');
    await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'load', timeout: 15000 });
    
    await page.locator('input[name=\"loginname\"]').first().fill('cocororinse');
    await page.locator('input[name=\"password\"]').first().fill('Cocoro0701');
    const submitBtn = page.locator('button:has-text(\"ログイン\"), .btn-primary, button[type=\"submit\"]').first();
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        submitBtn.click({ force: true })
    ]);
    
    console.log('After login URL:', page.url());
    
    // Go to shop dashboard if not already there
    if (!page.url().includes('/shop/')) {
        await page.goto('https://www.esthe-ranking.jp/shop/', { waitUntil: 'domcontentloaded' }).catch(()=>{});
        console.log('After goto shop URL:', page.url());
    }

    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.innerText.trim(),
            href: a.href
        })).filter(a => a.href.includes('therapist') || a.text.includes('女の子') || a.text.includes('キャスト'));
    });
    console.log('Cast links:', links);
    
    await browser.close();
}
run();
