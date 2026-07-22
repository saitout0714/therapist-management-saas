import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://estama.jp/login/');

  const html = await page.content();
  console.log('Login form HTML snippet:');
  const forms = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('form')).map(f => f.outerHTML);
  });
  console.log(forms.join('\n---\n'));

  await browser.close();
}

main();
