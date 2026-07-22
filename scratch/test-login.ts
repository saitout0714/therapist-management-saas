import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to login...');
    await page.goto('https://estama.jp/login/?r=/admin/');

    await page.fill('input[name="loginname"]', 'cocoro.rinse@gmail.com');
    await page.fill('input[name="password"]', 'masa1234');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
      page.click('button.login-btn')
    ]);

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'scratch/estama-login-result.png', fullPage: true });

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

main();
