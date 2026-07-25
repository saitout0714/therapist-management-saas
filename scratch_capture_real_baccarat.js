const { chromium } = require('playwright');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function captureRealBaccarat() {
  console.log("=== バカラユーザーログイン＆実画面キャプチャ撮影開始 ===");

  // テスト用パスワード `baccarat1234` のハッシュ作成して一時設定
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync('baccarat1234', salt);

  await supabase
    .from('users')
    .update({ password_hash: hash })
    .eq('login_id', 'baccarat');

  console.log("パスワード設定完了。Playwright 起動中...");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    console.log("localhost:3000/login へアクセス中...");
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 15000 });

    // ログイン入力
    await page.fill('input[type="text"]', 'baccarat');
    await page.fill('input[type="password"]', 'baccarat1234');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    // 顧客管理画面へ移動＆撮影
    console.log("顧客管理画面 (http://localhost:3000/customers) へ移動中...");
    await page.goto('http://localhost:3000/customers', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    const custPath = path.join(__dirname, 'manual_customers.png');
    await page.screenshot({ path: custPath });
    console.log("-> manual_customers.png 撮影大成功!");

    // セラピスト画面へ移動＆撮影
    console.log("セラピスト画面 (http://localhost:3000/therapists) へ移動中...");
    await page.goto('http://localhost:3000/therapists', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    const therPath = path.join(__dirname, 'manual_therapists.png');
    await page.screenshot({ path: therPath });
    console.log("-> manual_therapists.png 撮影大成功!");

  } catch (e) {
    console.error("撮影中にエラーが発生しました:", e.message);
  } finally {
    await browser.close();
  }
}

captureRealBaccarat();
