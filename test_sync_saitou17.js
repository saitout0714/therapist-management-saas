const { chromium } = require('playwright');
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://estama.jp/login/?r=/admin/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"mail\"], input[name=\"loginname\"], input[type=\"email\"], input[type=\"text\"]').first().fill('cocoro.rinse@gmail.com');
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill('masa1234');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('button[type=\"submit\"], input[type=\"submit\"], form button, .login-btn, a[type=\"submit\"], a.send-post').first().click()
    ]);
    
    await page.goto('https://estama.jp/admin/cast_edit/', { waitUntil: 'domcontentloaded' });
    
    // Print all inputs and whether they have validation / required / red borders
    await page.locator('input[name=\"name\"]').first().fill('âV“¡÷—æŽq');

    // Execute jQuery click and print console logs / alerts
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('dialog', async dialog => {
        console.log('DIALOG ALERT:', dialog.message());
        await dialog.dismiss();
    });

    await page.evaluate(() => {
        window.jQuery('a.btn-default_submit').click();
    });

    await page.waitForTimeout(2000);

    const alertMessage = await page.evaluate(() => {
        const errorElems = Array.from(document.querySelectorAll('.error, .alert, .invalid, .help-block, .err, span[style*=\"color: red\"], font[color=\"red\"]'));
        return errorElems.map(e => e.innerText);
    });
    console.log('Error Elements:', alertMessage);

    await browser.close();
}
run();
