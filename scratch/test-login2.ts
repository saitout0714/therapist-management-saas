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
      console.log('Found inputs. Filling...');
      await loginInput.fill('cocoro.rinse@gmail.com');
      await passInput.fill('masa1234');

      const submitButton = await page.$('button[type="submit"], input[type="submit"], form button, .login-btn, a[type="submit"], a.send-post');
      if (submitButton) {
        console.log('Found submit button. Clicking...');
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
          submitButton.click()
        ]);
      } else {
        await page.keyboard.press('Enter');
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      }
    }

    console.log('Login attempted. Current URL:', page.url());
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'scratch/estama-after-login.png', fullPage: true });

    // Now go to schedule
    console.log('Navigating to schedule...');
    await page.goto('https://estama.jp/admin/schedule/856663/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    
    console.log('At schedule. Current URL:', page.url());
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'scratch/estama-schedule-page.png', fullPage: true });

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

main();
