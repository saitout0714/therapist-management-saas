import { chromium as playwrightLocal, Page } from 'playwright';
import { downloadImageToTemp } from './download-image';
import fs from 'fs';

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
    await page.goto('https://estama.jp/login/?r=/admin/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(async () => {
      await page.goto('https://estama.jp/login/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    });
    
    try {
      await page.locator('input[name="login_id"], input[name="loginname"], input[name="username"], input[name="mail"], input[name="email"], input[type="text"], input[type="email"]').first().fill(loginId, { timeout: 10000 });
      await page.locator('input[name="login_pass"], input[name="password"], input[type="password"]').first().fill(password, { timeout: 10000 });
      
      const submitButton = page.locator('button[type="submit"], input[type="submit"], .login_btn, button:has-text("ログイン"), input[value*="ログイン"], a.send-post, a[type="submit"]').first();
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        submitButton.click({ timeout: 5000 }).catch(() => page.keyboard.press('Enter'))
      ]);
    } catch (e) {
      throw new Error('エステ魂のログイン入力項目が見つかりませんでした。');
    }

    // ログイン成否の確定チェック（キャスト管理画面へ遷移を試みる）
    let isNew = false;
    let editUrl = 'https://estama.jp/admin/cast/add/';
    if (estamaTherapistId) {
      editUrl = `https://estama.jp/admin/cast_edit/${estamaTherapistId}/`;
    } else {
      isNew = true;
    }

    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    
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
    if (therapist.photo_url) {
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        const tmpImagePath = await downloadImageToTemp(therapist.photo_url, 'estama_');
        if (tmpImagePath) {
          await fileInput.setInputFiles(tmpImagePath);
          // アップロード後にファイルを削除
          setTimeout(() => fs.unlink(tmpImagePath, () => {}), 5000);
        }
      }
    }

    // 保存ボタンをクリック
    try {
      const saveButton = page.locator('.save-btn, button:has-text("保存"), button:has-text("登録"), button[type="submit"], input[type="submit"]').first();
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        saveButton.click({ force: true, timeout: 10000 }).catch(() => page.evaluate(() => {
          const forms = Array.from(document.querySelectorAll('form'));
          const targetForm = forms.find(f => f.innerText.includes('保存') || f.innerText.includes('登録') || f.action.includes('add') || f.action.includes('edit')) || forms[forms.length - 1];
          if (targetForm) targetForm.submit();
        }))
      ]);
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
