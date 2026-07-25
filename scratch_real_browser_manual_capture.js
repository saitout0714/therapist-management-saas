const { chromium } = require('playwright');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function realBrowserManualCapture() {
  console.log("=== 実ブラウザUI操作によるマニュアルスクショ撮影開始 ===");

  // パスワードを baccarat1234 に設定
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync('baccarat1234', salt);
  await supabase.from('users').update({ password_hash: hash }).eq('login_id', 'baccarat');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    console.log("1. ログインページ (http://localhost:3000/login) へ移動");
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

    console.log("2. ログイン入力 (baccarat / baccarat1234)");
    await page.fill('input[placeholder="IDを入力してください"]', 'baccarat');
    await page.fill('input[type="password"]', 'baccarat1234');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
      page.click('button[type="submit"]')
    ]);

    await page.waitForTimeout(3000);
    console.log("ログイン後URL:", page.url());

    // 店舗選択ドロップダウンが存在するか確認
    console.log("3. 顧客管理画面へ移動");
    await page.goto('http://localhost:3000/customers', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 店舗選択（もし店舗が未選択状態ならドロップダウンをクリック）
    const selectElem = await page.$('select');
    if (selectElem) {
      console.log("店舗ドロップダウンを選択中...");
      await selectElem.selectOption({ index: 1 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    const txt1 = await page.innerText('body');
    console.log("顧客管理テキストサマリー:", txt1.substring(0, 200).replace(/\n/g, ' '));

    await page.screenshot({ path: path.join(__dirname, 'manual_customers.png') });
    console.log("manual_customers.png 撮影完了!");

    console.log("4. セラピスト画面へ移動");
    await page.goto('http://localhost:3000/therapists', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const txt2 = await page.innerText('body');
    console.log("セラピストテキストサマリー:", txt2.substring(0, 200).replace(/\n/g, ' '));

    await page.screenshot({ path: path.join(__dirname, 'manual_therapists.png') });
    console.log("manual_therapists.png 撮影完了!");

  } catch (e) {
    console.error("エラー:", e.message);
  } finally {
    await browser.close();
  }
}

realBrowserManualCapture();
