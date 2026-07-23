const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- ESTHE RANKING ---');
    await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'load', timeout: 15000 });
    
    // find all inputs on the login page
    const loginInputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, button')).map(el => ({
            tag: el.tagName,
            type: el.type,
            name: el.name,
            class: el.className,
            text: el.innerText || el.value
        }));
    });
    console.log('Login Inputs:', loginInputs);
    
    // try to login
    await page.locator('input[name=\"loginname\"], input[name=\"username\"], input[name=\"login_id\"], input[type=\"text\"]').first().fill('cocororinse');
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill('Cocoro0701');
    const submitBtn = page.locator('button[type=\"submit\"], input[type=\"submit\"], .btn-primary, .login-btn').first();
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        submitBtn.click()
    ]);
    
    console.log('After login URL:', page.url());
    
    // Is there a shop login link?
    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.innerText.trim(),
            href: a.href
        })).filter(a => a.href.includes('shop') || a.href.includes('login') || a.href.includes('admin'));
    });
    console.log('Shop/Admin links:', links);
    
    await browser.close();
}
run();
