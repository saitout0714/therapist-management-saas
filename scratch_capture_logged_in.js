const { chromium } = require('playwright');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function captureLoggedInScreenshots() {
  console.log("=== ログイン済み状態の画面キャプチャ撮影開始 ===");

  // テスト用ユーザーの認証情報またはシステム管理者の電子メールを取得
  const { data: users } = await supabase.from('users').select('email').limit(1);
  console.log("既存ユーザーメール:", users);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    console.log("localhost:3000/login へアクセス中...");
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 15000 });
    
    // ログインフォームへの入力試行
    const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="メール"]');
    const passInput = await page.$('input[type="password"]');

    if (emailInput && passInput) {
      console.log("ログインフォーム入力中...");
      await emailInput.fill('admin@example.com');
      await passInput.fill('password123');
      const submitBtn = await page.$('button[type="submit"]');
      if (submitBtn) await submitBtn.click();
      await page.waitForTimeout(3000);
    }

    // 直接画面へ移動
    console.log("localhost:3000/customers 撮影中...");
    await page.goto('http://localhost:3000/customers', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(__dirname, 'manual_customers.png') });

    console.log("localhost:3000/therapists 撮影中...");
    await page.goto('http://localhost:3000/therapists', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(__dirname, 'manual_therapists.png') });

    console.log("-> 撮影完了!");
  } catch (e) {
    console.error("撮影エラー:", e.message);
  } finally {
    await browser.close();
  }
}

captureLoggedInScreenshots();
