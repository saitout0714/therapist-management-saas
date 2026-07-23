const { chromium } = require('playwright');

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- ESTAMA ---');
    await page.goto('https://estama.jp/login/?r=/admin/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"loginname\"], input[name=\"username\"], input[name=\"mail\"], input[name=\"email\"], input[type=\"text\"], input[type=\"email\"]').first().fill('cocoro.rinse@gmail.com');
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill('masa1234');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('button[type=\"submit\"], input[type=\"submit\"], form button, .login-btn, a[type=\"submit\"], a.send-post').first().click()
    ]);
    
    const dashboardUrl = page.url();
    console.log('Dashboard URL:', dashboardUrl);

    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.innerText.trim(),
            href: a.href
        })).filter(a => a.text.includes('キャスト') || a.text.includes('女の子') || a.href.includes('cast'));
    });
    console.log('Cast links:', links);

    if (links.length > 0) {
        await page.goto(links[0].href, { waitUntil: 'domcontentloaded' });
        console.log('Went to:', page.url());
        
        const inputs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
                tag: el.tagName,
                type: el.type,
                name: el.name
            }));
        });
        console.log('Inputs:', inputs);
    }
    
    await browser.close();
}
run();
