const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function forceRenderCapture() {
  console.log("=== 100%確実にログイン後の管理画面を書き出して撮影する処理開始 ===");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // ミドルウェアやAPIをインターセプトして、ログイン済みユーザーとして本物のデータを返す
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('/login')) {
      // ログインページへのリダイレクトをキャンセルして /customers へ
      return route.fulfill({ status: 302, headers: { Location: '/customers' } });
    }
    route.continue();
  });

  // CookieおよびStorage
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

  await context.addCookies([
    { name: 'auth_user', value: encodeURIComponent(JSON.stringify(baccaratUser)), domain: 'localhost', path: '/' },
    { name: 'selected_shop', value: encodeURIComponent(JSON.stringify(baccaratUser.shops[0])), domain: 'localhost', path: '/' }
  ]);

  await page.addInitScript((u) => {
    window.localStorage.setItem('auth_user', u);
    window.localStorage.setItem('selected_shop', JSON.stringify({ id: "508def9b-cd72-439d-9bbc-2dbe5e3a8af4", name: "バカラ山口湯田" }));
  }, JSON.stringify(baccaratUser));

  try {
    await page.goto('http://localhost:3000/customers', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const bodyText = await page.innerText('body');
    console.log("画面ボディテキスト抜粋:", bodyText.substring(0, 200).replace(/\n/g, ' '));

    await page.screenshot({ path: path.join(__dirname, 'manual_customers.png') });
    console.log("manual_customers.png 撮影完了");

    await page.goto('http://localhost:3000/therapists', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(__dirname, 'manual_therapists.png') });
    console.log("manual_therapists.png 撮影完了");

  } catch (e) {
    console.error("エラー:", e.message);
  } finally {
    await browser.close();
  }
}

forceRenderCapture();
