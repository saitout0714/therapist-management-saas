const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- ESTHE RANKING ---');
    await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"loginname\"], input[name=\"username\"], input[name=\"login_id\"], input[type=\"text\"]').first().fill('cocororinse');
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill('Cocoro0701');
    const submitButton = page.locator('.btn-primary, button[type=\"submit\"], input[type=\"submit\"]').first();
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        submitButton.click()
    ]);
    
    console.log('Dashboard URL:', page.url());
    
    await page.goto('https://www.esthe-ranking.jp/shop/', { waitUntil: 'domcontentloaded' }).catch(()=>{});

    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.innerText.trim(),
            href: a.href
        })).filter(a => a.text.includes('セラピスト') || a.text.includes('女の子') || a.href.includes('therapist'));
    });
    console.log('Cast links:', links);

    if (links.length > 0) {
        await page.goto(links.find(l => l.text.includes('登録') || l.text.includes('追加') || l.href.includes('add') || l.href.includes('edit')).href, { waitUntil: 'domcontentloaded' });
        console.log('Went to:', page.url());
        
        const inputs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
                tag: el.tagName,
                type: el.type,
                name: el.name
            }));
        });
        console.log('Inputs:', JSON.stringify(inputs.filter(i => i.type !== 'hidden').slice(0, 10), null, 2));
    }
    
    await browser.close();
}
run();
