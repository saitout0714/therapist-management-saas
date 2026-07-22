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

  const html = await page.content();
  console.log('HTML length:', html.length);

  // Extract all table content, links, inputs, forms, and therapist names
  const info = await page.evaluate(() => {
    const text = document.body.innerText;
    const links = Array.from(document.querySelectorAll('a')).map(a => ({ href: a.href, text: a.innerText }));
    return { textSnippet: text.substring(0, 1000), links: links.filter(l => l.text) };
  });

  console.log('Text Snippet:', info.textSnippet);
  console.log('Links found:', info.links);

  await browser.close();
}

main();
