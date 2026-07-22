import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://estama.jp/login/');
  await page.fill('input[name="mail"]', 'cocoro.rinse@gmail.com');
  await page.fill('input[name="password"]', 'masa1234');
  await page.click('a.send-post');
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });

  await page.goto('https://estama.jp/admin/schedule/', { waitUntil: 'domcontentloaded' });

  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
      .map(a => ({ href: a.href, text: a.innerText?.trim() }))
      .filter(l => l.text && (l.href.includes('girl') || l.href.includes('thera') || l.href.includes('schedule') || l.href.includes('cast') || l.href.includes('staff')));
  });

  console.log('Filtered Admin Links:', links);

  await browser.close();
}

main();
