const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function renderPerfectBaccaratPage() {
  console.log("=== 店舗選択済み顧客一覧・セラピスト一覧の実画面撮影開始 ===");

  const baccaratUser = {
    id: "d605b392-183d-4dde-bb47-f76b59f15de8",
    loginId: "baccarat",
    name: "バカラ オーナー",
    role: "agency_client_owner",
    ownerId: "016a4306-25d3-470b-8be4-11c4b01ef7b3",
    ownerName: "バカラグループ",
    shops: [
      { id: "508def9b-cd72-439d-9bbc-2dbe5e3a8af4", name: "バカラ山口湯田" },
      { id: "e6b1cc21-c9eb-4fc1-888d-6f965a90c1df", name: "バカラ周南下松" }
    ]
  };

  const selectedShop = {
    id: "508def9b-cd72-439d-9bbc-2dbe5e3a8af4",
    name: "バカラ山口湯田"
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  // Cookie 注入
  await context.addCookies([
    { name: 'auth_user', value: encodeURIComponent(JSON.stringify(baccaratUser)), domain: 'localhost', path: '/' },
    { name: 'selected_shop', value: encodeURIComponent(JSON.stringify(selectedShop)), domain: 'localhost', path: '/' }
  ]);

  const page = await context.newPage();

  // Storage 注入
  await page.addInitScript(({ u, s }) => {
    window.localStorage.setItem('auth_user', u);
    window.localStorage.setItem('selected_shop', s);
  }, { u: JSON.stringify(baccaratUser), s: JSON.stringify(selectedShop) });

  try {
    console.log("顧客管理画面へ移動...");
    await page.goto('http://localhost:3000/customers', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 画面内容のテキスト確認
    const txt = await page.innerText('body');
    console.log("顧客画面テキスト部分:", txt.substring(0, 300).replace(/\n/g, ' '));

    await page.screenshot({ path: path.join(__dirname, 'manual_customers.png') });
    console.log("manual_customers.png 撮影完了!");

    console.log("セラピスト画面へ移動...");
    await page.goto('http://localhost:3000/therapists', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const txt2 = await page.innerText('body');
    console.log("セラピスト画面テキスト部分:", txt2.substring(0, 300).replace(/\n/g, ' '));

    await page.screenshot({ path: path.join(__dirname, 'manual_therapists.png') });
    console.log("manual_therapists.png 撮影完了!");

  } catch (e) {
    console.error("撮影エラー:", e.message);
  } finally {
    await browser.close();
  }
}

renderPerfectBaccaratPage();
