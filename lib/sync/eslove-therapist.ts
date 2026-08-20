import { chromium as playwrightLocal } from 'playwright';
import { downloadImageToTemp } from './download-image';
import fs from 'fs';
import { loginToEslove } from './eslove';

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
    // CHROMIUM_ARGS はLinuxサーバーレス向けの設定で、--single-process 等は
    // WindowsではChromiumがクラッシュするため、Windowsでは引数なしで起動する
    return await playwrightLocal.launch({
      headless: true,
      args: process.platform === 'win32' ? [] : CHROMIUM_ARGS,
    });
  } else {
    console.log('[EsloveTherapistSync] Dynamically importing playwright-core and @sparticuz/chromium...');
    const { chromium: playwrightCore } = await import('playwright-core');
    const chromium = (await import('@sparticuz/chromium')).default;

    chromium.setGraphicsMode = false;

    console.log('[EsloveTherapistSync] Launching playwrightCore...');
    return await playwrightCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
}

/** "https://twitter.com/foo" や "@foo" のようなURLからアカウント名だけを取り出す */
function extractHandle(urlOrHandle: string | null | undefined): string {
  if (!urlOrHandle) return '';
  const trimmed = urlOrHandle.trim();
  const match = trimmed.match(/(?:twitter\.com|x\.com)\/@?([^/?#]+)/i);
  if (match) return match[1];
  return trimmed.replace(/^@/, '');
}

export async function syncTherapistToEslove(
  shopUrl: string,
  loginId: string,
  password: string,
  therapist: any,
  esloveTherapistId: string | null
): Promise<{ success: boolean; newId?: string; error?: string }> {
  let browser;
  try {
    browser = await getBrowser();

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 }
    });
    const page = await context.newPage();

    await loginToEslove(page, shopUrl, loginId, password);

    // 1. 基本情報の編集ページへ移動（新規の場合はID無しの追加ページ）
    let isNew = false;
    let editUrl = 'https://eslove.jp/admin/shop/therapist/edit';
    if (esloveTherapistId) {
      editUrl = `https://eslove.jp/admin/shop/therapist/edit/${esloveTherapistId}`;
    } else {
      isNew = true;
    }

    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    if (page.url().includes('/login')) {
      throw new Error('エステラブログインに失敗しました。認証情報を確認してください。');
    }
    // Vue側のハイドレーション待ち（フォームが描画されるまで）
    await page.waitForSelector('input[name="name"]', { timeout: 15000 }).catch(() => {});

    // 2. フォームへ入力
    const nameInput = await page.$('input[name="name"]');
    if (nameInput) await nameInput.fill(therapist.name || '');

    const specNameInput = await page.$('input[name="specification_name"]');
    if (specNameInput) {
      const current = await specNameInput.inputValue().catch(() => '');
      if (!current) await specNameInput.fill(therapist.name || '');
    }

    if (therapist.age) {
      const ageSelect = await page.$('select[name="age"]');
      if (ageSelect) await ageSelect.selectOption(String(therapist.age)).catch(() => {});
    }

    if (therapist.height) {
      const heightSelect = await page.$('select[name="height"]');
      if (heightSelect) await heightSelect.selectOption(String(therapist.height)).catch(() => {});
    }

    if (therapist.comment) {
      const messageTextarea = await page.$('textarea[name="shop_message"]');
      if (messageTextarea) await messageTextarea.fill(therapist.comment);
    }

    const xHandle = extractHandle(therapist.x_url);
    if (xHandle) {
      const twitterInput = await page.$('input[name="twitter_id"]');
      if (twitterInput) await twitterInput.fill(xHandle);
    }

    // 3. 基本情報を保存
    const saveBtn = page.locator('button:has-text("内容を保存する"), input[value*="保存"]').first();
    if (await saveBtn.count() > 0) {
      await saveBtn.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    // 4. 新規登録の場合、保存後のURLまたは一覧ページの先頭からIDを取得する
    let newId = esloveTherapistId;
    if (isNew) {
      const afterUrl = page.url();
      const match = afterUrl.match(/\/therapist\/edit\/(\d+)/);
      if (match && match[1]) {
        newId = match[1];
      } else {
        await page.goto('https://eslove.jp/admin/shop/therapist', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        await page.waitForSelector('a[href*="/therapist/edit/"]', { timeout: 15000 }).catch(() => {});
        const firstEditHref = await page.evaluate(() => {
          const a = document.querySelector('a[href*="/therapist/edit/"]');
          return a ? a.getAttribute('href') : null;
        });
        const m = firstEditHref?.match(/\/therapist\/edit\/(\d+)/);
        if (m && m[1]) newId = m[1];
      }
    }

    // 5. 写真のアップロード（画像登録タブ）
    const photoUrls: string[] = therapist.photo_urls || (therapist.photos ? therapist.photos.map((p: any) => p.photo_url) : (therapist.photo_url ? [therapist.photo_url] : []));
    if (newId && photoUrls.length > 0) {
      const tmpPaths: string[] = [];
      try {
        await page.goto(`https://eslove.jp/admin/shop/therapist_image/${newId}`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        await page.waitForSelector('#therapistImageUpload, input[type="file"]', { timeout: 15000 }).catch(() => {});

        for (let i = 0; i < Math.min(photoUrls.length, 5); i++) {
          const url = photoUrls[i];
          if (!url) continue;
          const tmpPath = await downloadImageToTemp(url, `eslove_img_${i}_`, page);
          if (tmpPath) tmpPaths.push(tmpPath);
        }

        if (tmpPaths.length > 0) {
          const fileInput = page.locator('#therapistImageUpload, input[type="file"]').first();
          if (await fileInput.count() > 0) {
            // エステラブのファイル入力は multiple 属性が無く1回に1ファイルしか
            // 受け付けないため、1枚ずつ順番にアップロードする
            for (const tmpPath of tmpPaths) {
              await fileInput.setInputFiles(tmpPath).catch((e: any) => {
                console.warn('[EsloveTherapistSync] Photo upload failed:', e.message);
              });
              await page.waitForTimeout(1500);
            }

            const imageSaveBtn = page.locator('button:has-text("内容を保存する"), input[value*="保存"]').first();
            if (await imageSaveBtn.count() > 0) {
              await imageSaveBtn.click({ timeout: 5000 }).catch(() => {});
              await page.waitForTimeout(1000);
            }
          }
        }
      } finally {
        for (const p of tmpPaths) {
          setTimeout(() => fs.unlink(p, () => {}), 10000);
        }
      }
    }

    return { success: true, newId: newId || undefined };

  } catch (error: any) {
    return { success: false, error: error.message };
  } finally {
    if (browser) {
      try { await Promise.all(browser.contexts().map((c: any) => c.close())); } catch (e) {}
      await browser.close();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}
