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
    const list: { id: string, name: string }[] = [];
    document.querySelectorAll('a').forEach(a => {
      const match = a.href.match(/\/cast_edit\/(\d+)\/?/) || a.href.match(/\/cast\/(\d+)\/?/);
      const text = a.innerText?.trim();
      if (match && text && text !== '編集' && text !== '編 執') {
        list.push({ id: match[1], name: text });
      }
    });
    return list;
  });

  console.log('All Therapists on /admin/cast/:', therapists);
  const izumi = therapists.find(t => t.name.includes('いずみ'));
  console.log('Izumi found:', izumi);

  await browser.close();
}

main();
