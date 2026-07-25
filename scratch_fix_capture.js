const { chromium } = require('playwright');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCapture() {
  console.log("=== 確実にログイン完了後の実画面を撮影するスクリプト開始 ===");

  // パスワード設定
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync('baccarat1234', salt);
  await supabase.from('users').update({ password_hash: hash }).eq('login_id', 'baccarat');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    console.log("1. ログイン画面へアクセス");
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

    console.log("2. ログイン情報入力＆送信");
    await page.fill('input[type="text"]', 'baccarat');
    await page.fill('input[type="password"]', 'baccarat1234');
    await page.click('button[type="submit"]');

    // リダイレクト待ち
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(3000);

    console.log("3. 顧客管理画面へ移動");
    await page.goto('http://localhost:3000/customers', { waitUntil: 'networkidle' });
    // 表または要素が表示されるまでしっかり待機
    await page.waitForSelector('table', { timeout: 10000 }).catch(e => console.log("table Selector timeout:", e.message));
    await page.waitForTimeout(2000);

    const custPath = path.join(__dirname, 'manual_customers.png');
    await page.screenshot({ path: custPath });
    console.log("-> 顧客画面スクショ保存完了:", custPath);

    console.log("4. セラピスト管理画面へ移動");
    await page.goto('http://localhost:3000/therapists', { waitUntil: 'networkidle' });
    await page.waitForSelector('table', { timeout: 10000 }).catch(e => console.log("table Selector timeout:", e.message));
    await page.waitForTimeout(2000);

    const therPath = path.join(__dirname, 'manual_therapists.png');
    await page.screenshot({ path: therPath });
    console.log("-> セラピスト画面スクショ保存完了:", therPath);

  } catch (e) {
    console.error("キャプチャエラー:", e);
  } finally {
    await browser.close();
  }
}

fixCapture();
