const { chromium } = require('playwright');
const fs = require('fs');

async function test() {
  const CHROMIUM_ARGS = [
    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote',
    '--single-process', '--disable-gpu'
  ];
  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page1 = await context.newPage();
  console.log('Estama Login...');
  await page1.goto('https://estama.jp/login/?r=/admin/');
  await page1.fill('input[name="login_id"]', 'cocoro.rinse@gmail.com');
  await page1.fill('input[name="login_pass"]', '0368222384');
  await page1.click('button[type="submit"], input[type="submit"], .login_btn');
  await page1.waitForLoadState('domcontentloaded');
  
  await page1.goto('https://estama.jp/admin/cast/edit/');
  const estamaInputs = await page1.evaluate(() => {
    return Array.from(document.querySelectorAll('input, select, textarea')).map(e => ({tag: e.tagName, name: e.name, id: e.id, type: e.type})).filter(e => e.name);
  });
  console.log('Estama Inputs:', JSON.stringify(estamaInputs, null, 2));

  const page2 = await context.newPage();
  console.log('Mens Ranking Login...');
  await page2.goto('https://www.esthe-ranking.jp/login/');
  await page2.fill('input[name="loginname"]', 'cocororinse');
  await page2.fill('input[name="password"]', 'akb2024');
  await page2.click('button:has-text("ƒƒOƒCƒ“")');
  await page2.waitForLoadState('domcontentloaded');
  
  await page2.goto('https://www.esthe-ranking.jp/shop/therapist/add/');
  const mensInputs = await page2.evaluate(() => {
    return Array.from(document.querySelectorAll('input, select, textarea')).map(e => ({tag: e.tagName, name: e.name, id: e.id, type: e.type})).filter(e => e.name);
  });
  console.log('Mens Inputs:', JSON.stringify(mensInputs, null, 2));

  await browser.close();
}
test().catch(console.error);
