import { chromium } from 'playwright';
import fs from 'fs';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to login...');
    await page.goto('https://estama.jp/login/?r=/admin/');

    console.log('Filling credentials...');
    const loginInput = await page.$('input[name="loginname"], input[name="username"], input[name="mail"], input[name="email"], input[type="text"], input[type="email"]');
    const passInput = await page.$('input[name="password"], input[type="password"]');
    
    if (loginInput && passInput) {
      await loginInput.fill('cocoro.rinse@gmail.com');
      await passInput.fill('masa1234');

      const submitButton = await page.$('button[type="submit"], input[type="submit"], form button, .login-btn');
      if (submitButton) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
          submitButton.click()
        ]);
      } else {
        await page.keyboard.press('Enter');
        await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      }
    }

    console.log('Logged in. Navigating to schedule...');
    await page.goto('https://estama.jp/admin/schedule/', { waitUntil: 'networkidle', timeout: 15000 });
    
    // Give it a moment to render JS if any
    await page.waitForTimeout(3000);

    console.log('Taking screenshot...');
    await page.screenshot({ path: 'scratch/estama-schedule2.png', fullPage: true });

    console.log('Dumping HTML...');
    const html = await page.content();
    fs.writeFileSync('scratch/estama-schedule2.html', html);

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

main();
