const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function injectAuthCapture() {
  console.log("=== Auth トークン直接注入による実画面撮影開始 ===");

  const userObj = {
    id: "d605b392-183d-4dde-bb47-f76b59f15de8",
    loginId: "baccarat",
    name: "バカラ オーナー",
    role: "agency_client_owner",
    ownerId: "016a4306-25d3-470b-8be4-11c4b01ef7b3",
    ownerName: "バカラグループ",
    shops: [
      { id: "508def9b-cd72-439d-9bbc-2dbe5e3a8af4", name: "バカラ山口湯田" },
      { id: "e6b1cc21-c9eb-4fc1-888d-6f965a90c1df", name: "バカラ周南下松" },
      { id: "960d84c5-d1cd-44bc-a39a-85f8ecc3d51a", name: "バカラ宇部" },
      { id: "7d430288-8aed-4381-b3bf-f35fad962d2f", name: "バカラ岩国" }
    ]
  };

  const userStr = JSON.stringify(userObj);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  // Cookie 注入
  await context.addCookies([{
    name: 'auth_user',
    value: encodeURIComponent(userStr),
    domain: 'localhost',
    path: '/',
  }]);

  const page = await context.newPage();

  // localStorage 注入 (domcontentloaded 前)
  await page.addInitScript((val) => {
    window.localStorage.setItem('auth_user', val);
    window.localStorage.setItem('selected_shop', JSON.stringify({
      id: "508def9b-cd72-439d-9bbc-2dbe5e3a8af4",
      name: "バカラ山口湯田"
    }));
  }, userStr);

  try {
    console.log("1. 顧客管理画面 (http://localhost:3000/customers) へアクセス");
    await page.goto('http://localhost:3000/customers', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);

    const custPath = path.join(__dirname, 'manual_customers.png');
    await page.screenshot({ path: custPath });
    console.log("-> 顧客管理画面の撮影大成功!");

    console.log("2. セラピスト画面 (http://localhost:3000/therapists) へアクセス");
    await page.goto('http://localhost:3000/therapists', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);

    const therPath = path.join(__dirname, 'manual_therapists.png');
    await page.screenshot({ path: therPath });
    console.log("-> セラピスト画面の撮影大成功!");

  } catch (e) {
    console.error("撮影エラー:", e.message);
  } finally {
    await browser.close();
  }
}

injectAuthCapture();
