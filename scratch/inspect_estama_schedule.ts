import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to Estama login...');
  await page.goto('https://estama.jp/login/?r=/admin/');

  const loginInput = await page.$('input[name="loginname"], input[name="username"], input[name="mail"], input[type="text"]');
  const passInput = await page.$('input[name="password"], input[type="password"]');

  if (loginInput && passInput) {
    await loginInput.fill('cocoro.rinse@gmail.com');
    await passInput.fill('masa1234');
    const submitBtn = await page.$('button[type="submit"], input[type="submit"], form button, .login-btn');
    if (submitBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
        submitBtn.click()
      ]);
    }
  }

  console.log('Navigating to schedule page...');
  await page.goto('https://estama.jp/admin/schedule/', { waitUntil: 'domcontentloaded' });

  console.log('Current Page URL:', page.url());
  console.log('Current Page Title:', await page.title());

  const links = await page.evaluate(() => {
    const list: { href: string, text: string }[] = [];
    document.querySelectorAll('a').forEach(a => {
      if (a.href.includes('/schedule/')) {
        list.push({ href: a.href, text: a.textContent?.trim() || '' });
      }
    });
    return list;
  });

  console.log('Schedule links on Estama:', links);

  const options = await page.evaluate(() => {
    const list: { val: string, text: string }[] = [];
    document.querySelectorAll('select option').forEach(opt => {
      list.push({ val: (opt as HTMLOptionElement).value, text: opt.textContent?.trim() || '' });
    });
    return list;
  });

  console.log('Select options on Estama:', options.slice(0, 30));

  await browser.close();
}

main();
