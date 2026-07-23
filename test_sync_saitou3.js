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
    await page.locator('input[name=\"name\"]').first().fill('âV“¡÷—æŽq');

    // Fill form and try form.submit() directly
    const submitResult = await page.evaluate(() => {
        const form = document.querySelector('form');
        if (form) {
            // trigger submit event
            const event = new Event('submit', { bubbles: true, cancelable: true });
            const notCancelled = form.dispatchEvent(event);
            return { notCancelled, action: form.action, method: form.method };
        }
        return null;
    });
    console.log('Form Submit Event Dispatch:', submitResult);

    // Also check required fields or error elements on form
    const formFields = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('tr, .form-group, .l-edit_row')).map(row => ({
            text: row.innerText.replace(/\s+/g, ' ').trim(),
            hasRequired: row.innerText.includes('•K{') || row.innerText.includes('¦'),
            inputNames: Array.from(row.querySelectorAll('input, select, textarea')).map(i => i.name)
        })).filter(r => r.inputNames.length > 0);
    });
    console.log('Form Fields:', JSON.stringify(formFields.slice(0, 15), null, 2));

    await browser.close();
}
run();
