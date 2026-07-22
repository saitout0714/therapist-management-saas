import { chromium } from 'playwright';
import fs from 'fs';

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

    await page.waitForTimeout(1000);
    console.log('URL after login:', page.url());

    console.log('Navigating to schedule...');
    await page.goto('https://estama.jp/admin/schedule/856663/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    
    await page.waitForTimeout(2000);
    
    // Save HTML for analysis
    fs.writeFileSync('scratch/estama-schedule-real.html', await page.content());

    // Extract select options
    const options = await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      const uniqueOptions = new Set<string>();
      selects.forEach((sel) => {
        const opts = Array.from(sel.options).map(o => `${o.value}: ${o.text.trim()}`);
        const sig = opts.join(' | ');
        uniqueOptions.add(sig);
      });
      return Array.from(uniqueOptions);
    });

    console.log('Unique Select types on page:', options);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

main();
