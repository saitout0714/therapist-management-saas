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

  // Test 1: /admin/cast/
  console.log('Navigating to /admin/cast/...');
  await page.goto('https://estama.jp/admin/cast/', { waitUntil: 'domcontentloaded' });
  const castLinks = await page.evaluate(() => {
    const list: { href: string, text: string }[] = [];
    document.querySelectorAll('a').forEach(a => {
      list.push({ href: a.href, text: a.innerText?.trim() || '' });
    });
    return list.filter(l => l.text);
  });
  console.log('/admin/cast/ links sample:', castLinks.slice(0, 30));

  // Test 2: /admin/schedule/list/
  console.log('Navigating to /admin/schedule/list/...');
  await page.goto('https://estama.jp/admin/schedule/list/', { waitUntil: 'domcontentloaded' });
  const schedListLinks = await page.evaluate(() => {
    const list: { href: string, text: string }[] = [];
    document.querySelectorAll('a, option').forEach(el => {
      const href = (el as HTMLAnchorElement).href || (el as HTMLOptionElement).value || '';
      const text = el.innerText?.trim() || el.textContent?.trim() || '';
      list.push({ href, text });
    });
    return list.filter(l => l.text);
  });
  console.log('/admin/schedule/list/ links sample:', schedListLinks.slice(0, 30));

  await browser.close();
}

main();
