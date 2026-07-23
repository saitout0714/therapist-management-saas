const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const { data: therapist } = await supabase.from('therapists').select('*').eq('id', 'efa75b28-06da-4238-8d1c-d2c07e12b8aa').single();
    const { data: shop } = await supabase.from('shops').select('*').eq('id', therapist.shop_id).single();

    console.log('Therapist:', therapist.name);
    console.log('Estama Shop URL:', shop.estama_shop_url);
    console.log('Estama Login ID:', shop.estama_login_id);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // 1. Login
    await page.goto('https://estama.jp/login/?r=/admin/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"mail\"], input[name=\"loginname\"], input[type=\"email\"], input[type=\"text\"]').first().fill(shop.estama_login_id);
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill(shop.estama_password);
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('button[type=\"submit\"], input[type=\"submit\"], form button, .login-btn, a[type=\"submit\"], a.send-post').first().click()
    ]);
    console.log('Login URL:', page.url());

    // 2. Go to Edit
    await page.goto('https://estama.jp/admin/cast_edit/', { waitUntil: 'domcontentloaded' });
    console.log('Edit URL:', page.url());

    // 3. Fill name
    const nameInput = page.locator('input[name=\"name\"]').first();
    await nameInput.fill(therapist.name);
    console.log('Filled name:', therapist.name);

    // Fill age
    if (therapist.age) {
        const ageInput = page.locator('input[name=\"age\"], select[name=\"age\"]').first();
        if (await ageInput.count() > 0) await ageInput.fill(String(therapist.age)).catch(() => {});
    }

    // 4. Click Save button
    const saveButton = page.locator('a.btn-default_submit, a:has-text(\"•Û‘¶‚·‚é\"), a:has-text(\"•Û‘¶\"), .save-btn, button:has-text(\"•Û‘¶\"), button:has-text(\"“o˜^\")').first();
    console.log('Save button text:', await saveButton.innerText().catch(() => 'none'));
    
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        saveButton.click({ force: true })
    ]);

    console.log('After Save URL:', page.url());

    // Check if error exists on page
    const pageText = await page.evaluate(() => document.body.innerText);
    const errors = pageText.split('\n').filter(l => l.includes('ƒGƒ‰[') || l.includes('“ü—Í') || l.includes('•K{') || l.includes('€–Ú'));
    console.log('Page Errors after save:', errors);

    await browser.close();
}
run();
