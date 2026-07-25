const { chromium } = require('playwright');
const fs = require('fs');

async function captureManualScreenshots() {
  console.log("=== マニュアル用画面キャプチャ撮影開始 ===");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  try {
    // 顧客管理画面へアクセス
    console.log("顧客管理画面へアクセス中...");
    await page.goto('http://localhost:3000/customers', { waitUntil: 'networkidle', timeout: 10000 });
    await page.screenshot({ path: 'manual_customers.png' });
    console.log("-> manual_customers.png 撮影完了");

    // セラピスト画面へアクセス
    console.log("セラピスト管理画面へアクセス中...");
    await page.goto('http://localhost:3000/therapists', { waitUntil: 'networkidle', timeout: 10000 });
    await page.screenshot({ path: 'manual_therapists.png' });
    console.log("-> manual_therapists.png 撮影完了");

  } catch (e) {
    console.error("キャプチャ撮影エラー:", e.message);
  } finally {
    await browser.close();
  }
}

captureManualScreenshots();
