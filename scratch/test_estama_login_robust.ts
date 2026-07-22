import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to login...');
  await page.goto('https://estama.jp/login/');

  await page.fill('input[name="mail"]', 'cocoro.rinse@gmail.com');
  await page.fill('input[name="password"]', 'masa1234');

  console.log('Clicking login...');
  await page.click('a.send-post');

  // Wait for redirect away from login page
  console.log('Waiting for URL change...');
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 }).catch(e => console.error('URL wait error:', e));

  console.log('Post-login URL:', page.url());
  console.log('Post-login Title:', await page.title());

  await page.goto('https://estama.jp/admin/schedule/', { waitUntil: 'domcontentloaded' });
  console.log('Schedule Page URL:', page.url());
  console.log('Schedule Page Title:', await page.title());

  const therapists = await page.evaluate(() => {
    const list: { id: string, name: string }[] = [];
    document.querySelectorAll('a[href*="/schedule/"]').forEach(a => {
      const match = a.getAttribute('href')?.match(/\/schedule\/(\d+)\/?/);
      if (match) list.push({ id: match[1], name: a.textContent?.trim() || '' });
    });
    document.querySelectorAll('select option').forEach(opt => {
      const val = (opt as HTMLOptionElement).value;
      if (/^\d+$/.test(val)) list.push({ id: val, name: opt.textContent?.trim() || '' });
    });
    return list;
  });

  console.log('Therapists found on Estama:', therapists);

  await browser.close();
}

main();
