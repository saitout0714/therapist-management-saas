const { chromium } = require('playwright');
const path = require('path');

async function captureYoyaklScreenshots() {
  console.log("=== yoyakl.tokyo 画面キャプチャ撮影開始 ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    console.log("yoyakl.tokyo/customers へアクセス中...");
    await page.goto('https://yoyakl.tokyo/customers', { waitUntil: 'networkidle', timeout: 15000 });
    
    // 画像撮影
    const custPath = path.join(__dirname, 'manual_customers.png');
    await page.screenshot({ path: custPath });
    console.log("-> manual_customers.png 撮影成功!");

    console.log("yoyakl.tokyo/therapists へアクセス中...");
    await page.goto('https://yoyakl.tokyo/therapists', { waitUntil: 'networkidle', timeout: 15000 });
    const therPath = path.join(__dirname, 'manual_therapists.png');
    await page.screenshot({ path: therPath });
    console.log("-> manual_therapists.png 撮影成功!");

  } catch (e) {
    console.error("撮影エラー:", e.message);
  } finally {
    await browser.close();
  }
}

captureYoyaklScreenshots();
