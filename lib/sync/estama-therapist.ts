import { chromium as playwrightLocal, Page } from 'playwright';
import { downloadImageToTemp } from './download-image';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function uploadDebugScreenshot(page: any, name: string) {
  try {
    const buffer = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: true });
    await supabase.storage.from('therapist-photos').upload(`debug/${name}_${Date.now()}.jpg`, buffer, { contentType: 'image/jpeg', upsert: true });
  } catch (e) {
    console.error('Screenshot failed:', e);
  }
}

const CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-zygote',
  '--single-process',
  '--disable-gpu'
];

async function getBrowser() {
  const isLocal = !!process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.NODE_ENV === 'development' || !process.env.VERCEL;

  if (isLocal) {
    return await playwrightLocal.launch({
      headless: true,
      args: CHROMIUM_ARGS,
    });
  } else {
    console.log('[EstamaTherapistSync] Dynamically importing playwright-core and @sparticuz/chromium...');
    const { chromium: playwrightCore } = await import('playwright-core');
    const chromium = (await import('@sparticuz/chromium')).default;
    
    chromium.setGraphicsMode = false;

    console.log('[EstamaTherapistSync] Launching playwrightCore...');
    return await playwrightCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
}

export async function syncTherapistToEstama(
  shopUrl: string,
  loginId: string,
  password: string,
  therapist: any,
  estamaTherapistId: string | null
): Promise<{ success: boolean; newId?: string; error?: string }> {
  let browser;
  try {
    browser = await getBrowser();
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // 1. Login
    await page.goto('https://estama.jp/login/?r=/admin/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(async () => {
      await page.goto('https://estama.jp/login/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
    
    try {
      await uploadDebugScreenshot(page, 'estama_after_login');
      await page.locator('input[name="mail"], input[name="loginname"], input[name="username"], input[type="email"], input[type="text"]').first().fill(loginId, { timeout: 10000 });
      await page.locator('input[name="password"], input[type="password"]').first().fill(password, { timeout: 10000 });
      
      const submitButton = page.locator('button[type="submit"], input[type="submit"], form button, .login-btn, a[type="submit"], a.send-post').first();
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        submitButton.click({ timeout: 5000 }).catch(() => page.locator('a.send-post').first().click())
      ]);
    } catch (e) {
      throw new Error('エステ魂のログイン入力項目が見つかりませんでした。');
    }

    // 2. Navigate to Edit / Create page
    let isNew = false;
    let editUrl = 'https://estama.jp/admin/cast_edit/';
    if (estamaTherapistId) {
      editUrl = `https://estama.jp/admin/cast_edit/${estamaTherapistId}/`;
    } else {
      isNew = true;
    }

    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    
    if (page.url().includes('/login')) {
      throw new Error('エステ魂ログインに失敗しました。認証情報を確認してください。');
    }
    
    // 3. Fill the form
    // 名前 (よくあるname属性: name, cast_name, therapist_name, nick_name)
    const nameInput = await page.$('input[name="name"], input[name="cast_name"], input[name="nick_name"]');
    if (nameInput) await nameInput.fill(therapist.name);

    // 年齢 (age)
    if (therapist.age) {
      const ageInput = await page.$('input[name="age"], select[name="age"]');
      if (ageInput) {
        const tagName = await ageInput.evaluate(e => e.tagName.toLowerCase());
        if (tagName === 'select') await ageInput.selectOption(String(therapist.age));
        else await ageInput.fill(String(therapist.age));
      }
    }

    // T, B, W, H
    if (therapist.height) {
      const tInput = await page.$('input[name="t"], input[name="height"]');
      if (tInput) await tInput.fill(String(therapist.height));
    }
    if (therapist.bust) {
      const bInput = await page.$('input[name="b"], input[name="bust"]');
      if (bInput) await bInput.fill(String(therapist.bust));
    }
    if (therapist.waist) {
      const wInput = await page.$('input[name="w"], input[name="waist"]');
      if (wInput) await wInput.fill(String(therapist.waist));
    }
    if (therapist.hip) {
      const hInput = await page.$('input[name="h"], input[name="hip"]');
      if (hInput) await hInput.fill(String(therapist.hip));
    }
    
    // カップ数 (cup)
    if (therapist.bust_cup) {
      const cupInput = await page.$('input[name="cup"], select[name="cup"], input[name="bust_cup"]');
      if (cupInput) {
        const tagName = await cupInput.evaluate(e => e.tagName.toLowerCase());
        if (tagName === 'select') {
          await cupInput.selectOption({ label: therapist.bust_cup }).catch(() => {});
        } else {
          await cupInput.fill(therapist.bust_cup);
        }
      }
    }

    // 一言コメント・自己紹介 (message, comment, intro)
    if (therapist.comment) {
      const commentInput = await page.$('textarea[name="comment"], textarea[name="message"], textarea[name="intro"]');
      if (commentInput) await commentInput.fill(therapist.comment);
    }

    // 写真のアップロード
    await uploadDebugScreenshot(page, 'estama_before_photo');
    const photoUrls = therapist.photo_urls || (therapist.photos ? therapist.photos.map((p: any) => p.photo_url) : (therapist.photo_url ? [therapist.photo_url] : []));
    if (photoUrls.length > 0) {
      for (let i = 0; i < Math.min(photoUrls.length, 6); i++) {
        const url = photoUrls[i];
        if (!url) continue;
        const fileInput = await page.$(`#cast_icon_${i + 1}`);
        if (fileInput) {
          const tmpImagePath = await downloadImageToTemp(url, `estama_img_${i}_`);
          if (tmpImagePath) {
            await fileInput.setInputFiles(tmpImagePath);
            setTimeout(() => fs.unlink(tmpImagePath, () => {}), 10000);
          }
        }
      }
    }

    // 必須属性（タイプ等）のチェックボックスが未選択の場合は1つ目をチェック
    try {
      const checkboxes = page.locator('input[type="checkbox"]');
      if (await checkboxes.count() > 0) {
        const checkedCount = await page.locator('input[type="checkbox"]:checked').count();
        if (checkedCount === 0) {
          await checkboxes.first().check().catch(() => {});
        }
      }
    } catch (e) {}

    // 保存ボタンをクリック
    try {
      await uploadDebugScreenshot(page, 'estama_before_save');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
        page.evaluate(() => {
          const form = document.querySelector('form');
          if (form) form.submit();
        })
      ]);
      await uploadDebugScreenshot(page, 'estama_after_save');
    } catch (e) {
      console.error('Failed to click save button:', e);
    }
    
    // 新規登録の場合、IDを取得するためにURLや一覧ページを確認する
    let newId = estamaTherapistId;
    if (isNew) {
      // 保存後のURLからIDが取れるか？
      const afterUrl = page.url();
      const match = afterUrl.match(/\/cast_edit\/(\d+)/);
      if (match && match[1]) {
        newId = match[1];
      } else {
        // 取れなければ一覧に戻って一番上のIDを取る
        await page.goto('https://estama.jp/admin/cast/');
        const firstLink = await page.$('a[href*="/cast_edit/"]');
        if (firstLink) {
          const href = await firstLink.getAttribute('href');
          const m = href?.match(/\/cast_edit\/(\d+)/);
          if (m && m[1]) newId = m[1];
        }
      }
    }

    return { success: true, newId: newId || undefined };

  } catch (error: any) {
    return { success: false, error: error.message };
  } finally {
    if (browser) {
      try { await Promise.all(browser.contexts().map((c: any) => c.close())); } catch(e){} 
      await browser.close();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}
