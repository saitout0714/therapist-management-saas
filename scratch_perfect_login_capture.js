const { chromium } = require('playwright');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function perfectLoginCapture() {
  console.log("=== Playwright 完全ログイン＆UI撮影スクリプト開始 ===");

  // パスワード設定
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync('baccarat1234', salt);
  await supabase.from('users').update({ password_hash: hash }).eq('login_id', 'baccarat');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    console.log("1. ログインページへアクセス");
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

    console.log("2. ログインフォーム入力");
    await page.fill('input[placeholder="IDを入力してください"]', 'baccarat');
    await page.fill('input[type="password"]', 'baccarat1234');
    
    console.log("3. ログインボタン押下");
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
      page.click('button[type="submit"]')
    ]);

    await page.waitForTimeout(4000);

    console.log("現在のURL:", page.url());

    // 店舗選択等のモーダルがある場合やドロップダウンがある場合の対応
    console.log("4. 顧客管理画面 (http://localhost:3000/customers) へ移動");
    await page.goto('http://localhost:3000/customers', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const custPath = path.join(__dirname, 'manual_customers.png');
    await page.screenshot({ path: custPath, fullPage: false });
    console.log("-> manual_customers.png 撮影完了! URL:", page.url());

    console.log("5. セラピスト画面 (http://localhost:3000/therapists) へ移動");
    await page.goto('http://localhost:3000/therapists', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const therPath = path.join(__dirname, 'manual_therapists.png');
    await page.screenshot({ path: therPath, fullPage: false });
    console.log("-> manual_therapists.png 撮影完了! URL:", page.url());

  } catch (e) {
    console.error("キャプチャ失敗:", e);
  } finally {
    await browser.close();
  }
}

perfectLoginCapture();
