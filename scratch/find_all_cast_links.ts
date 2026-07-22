import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://estama.jp/login/');
  await page.fill('input[name="mail"]', 'cocoro.rinse@gmail.com');
  await page.fill('input[name="password"]', 'masa1234');
  await page.click('a.send-post');
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });

  await page.goto('https://estama.jp/admin/cast/', { waitUntil: 'domcontentloaded' });

  const therapists = await page.evaluate(() => {
    const list: { href: string, text: string }[] = [];
    document.querySelectorAll('a').forEach(a => {
      if (a.href.includes('/cast') || a.href.includes('/schedule')) {
        list.push({ href: a.href, text: a.innerText?.trim() || '' });
      }
    });
    return list;
  });

  console.log('/admin/cast/ therapist links:', therapists.filter(t => t.text && t.text.length < 20));

  await browser.close();
}

main();
