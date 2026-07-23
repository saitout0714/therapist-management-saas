const { chromium } = require('playwright');
const fs = require('fs');

async function test() {
  const browser = await chromium.launch({ headless: true });
  
  const context = await browser.newContext();
  
  const page1 = await context.newPage();
  console.log('Estama Login...');
  await page1.goto('https://estama.jp/login/?r=/admin/');
  await page1.fill('input[name="login_id"]', 'cocoro.rinse@gmail.com');
  await page1.fill('input[name="login_pass"]', '0368222384');
  await Promise.all([
    page1.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page1.click('button[type="submit"], input[type="submit"], .login_btn')
  ]);
  
  await page1.goto('https://estama.jp/admin/cast/edit/');
  fs.writeFileSync('estama_new_cast.html', await page1.content());
  console.log('Estama Done');

  const page2 = await context.newPage();
  console.log('Mens Ranking Login...');
  await page2.goto('https://www.esthe-ranking.jp/login/');
  await page2.fill('input[name="loginname"]', 'cocororinse');
  await page2.fill('input[name="password"]', 'akb2024');
  await Promise.all([
    page2.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page2.click('button:has-text("ÉçÉOÉCÉì")')
  ]);
  
  await page2.goto('https://www.esthe-ranking.jp/shop/therapist/add/');
  fs.writeFileSync('mens_new_cast.html', await page2.content());
  console.log('Mens Ranking Done');

  await browser.close();
}
test().catch(console.error);
