import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to login...');
    await page.goto('https://estama.jp/login/?r=/admin/');

    const loginInput = await page.$('input[name="loginname"], input[name="username"], input[name="mail"], input[name="email"], input[type="text"], input[type="email"]');
    const passInput = await page.$('input[name="password"], input[type="password"]');

    if (loginInput && passInput) {
      await loginInput.fill('cocoro.rinse@gmail.com');
      await passInput.fill('masa1234');
      const submitButton = await page.$('button[type="submit"], input[type="submit"], form button, .login-btn, a[type="submit"], a.send-post');
      if (submitButton) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
          submitButton.click()
        ]);
      }
    }

    console.log('Navigating to schedule for 856663 (Takanashi)...');
    await page.goto('https://estama.jp/admin/schedule/856663/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    
    await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      selects.forEach(sel => {
        if (sel.name && sel.name.includes('2026-07-22') && sel.name.includes('[17:00]')) {
          sel.value = '1'; // Set to ○
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('Set 17:00 to ○');
        }
        if (sel.name && sel.name.includes('2026-07-22') && sel.name.includes('[17:30]')) {
          sel.value = '1'; // Set to ○
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('Set 17:30 to ○');
        }
        if (sel.name && sel.name.includes('2026-07-22') && sel.name.includes('[18:00]')) {
          sel.value = '1'; // Set to ○
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('Set 18:00 to ○');
        }
      });
    });

    console.log('Clicking Save...');
    const saveBtn = await page.$('#SendWorkSchedule, button:has-text("出勤情報を保存する"), input[value*="保存"], a:has-text("保存")');
    if (saveBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        saveBtn.click()
      ]);
      await page.waitForTimeout(2000);
      console.log('Save complete. Current URL:', page.url());
      await page.screenshot({ path: 'scratch/estama-after-save-circle.png', fullPage: true });
    } else {
      console.log('Save button not found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

main();
