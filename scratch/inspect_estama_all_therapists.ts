import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to login...');
  await page.goto('https://estama.jp/login/');

  await page.fill('input[name="mail"]', 'cocoro.rinse@gmail.com');
  await page.fill('input[name="password"]', 'masa1234');
  await page.click('a.send-post');

  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });

  // 1. Check /admin/girl/ (セラピスト管理ページ)
  console.log('Navigating to /admin/girl/...');
  await page.goto('https://estama.jp/admin/girl/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('Girl Page URL:', page.url());
  console.log('Girl Page Title:', await page.title());

  const girlLinks = await page.evaluate(() => {
    const list: { href: string, text: string }[] = [];
    document.querySelectorAll('a').forEach(a => {
      list.push({ href: a.href, text: a.textContent?.trim() || '' });
    });
    return list;
  });
  console.log('All links on /admin/girl/:', girlLinks.filter(l => l.href.includes('/girl/') || l.href.includes('/schedule/')));

  // 2. Check /admin/schedule/ (出勤管理ページ)
  console.log('Navigating to /admin/schedule/...');
  await page.goto('https://estama.jp/admin/schedule/', { waitUntil: 'domcontentloaded' });

  const selectOptions = await page.evaluate(() => {
    const opts: { val: string, text: string }[] = [];
    document.querySelectorAll('select option').forEach(o => {
      opts.push({ val: (o as HTMLOptionElement).value, text: o.textContent?.trim() || '' });
    });
    return opts;
  });
  console.log('All select options on /admin/schedule/:', selectOptions);

  await browser.close();
}

main();
