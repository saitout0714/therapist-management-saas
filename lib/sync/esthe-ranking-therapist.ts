import { chromium, Page } from 'playwright';
import { downloadImageToTemp } from './download-image';
import fs from 'fs';

export async function syncTherapistToEstheRanking(
  shopUrl: string,
  loginId: string,
  password: string,
  therapist: any,
  rankingTherapistId: string | null
): Promise<{ success: boolean; newId?: string; error?: string }> {
  let browser;
  try {
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
    
    browser = await chromium.launch({
      headless: true,
      args: process.env.NODE_ENV === 'production' ? CHROMIUM_ARGS : undefined,
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // 1. Login
    await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.fill('input[name="loginname"]', loginId);
    await page.fill('input[name="password"]', password);
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      page.click('button:has-text("ログイン")')
    ]);

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('メンズエステランキングのログインに失敗しました。認証情報を確認してください。');
    }

    // 2. Navigate to Edit / Create page
    let isNew = false;
    let editUrl = 'https://www.esthe-ranking.jp/shop/therapist/add/';
    if (rankingTherapistId) {
      editUrl = `https://www.esthe-ranking.jp/shop/therapist/edit/${rankingTherapistId}/`;
    } else {
      isNew = true;
    }

    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // 3. Fill the form
    // 名前
    const nameInput = await page.$('input[name="name"], input[name="nick_name"]');
    if (nameInput) await nameInput.fill(therapist.name);

    // 年齢
    if (therapist.age) {
      const ageInput = await page.$('input[name="age"], select[name="age"]');
      if (ageInput) {
        const tagName = await ageInput.evaluate(e => e.tagName.toLowerCase());
        if (tagName === 'select') await ageInput.selectOption(String(therapist.age)).catch(() => {});
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
    
    // カップ数
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

    // 一言コメント・自己紹介
    if (therapist.comment) {
      const commentInput = await page.$('textarea[name="comment"], textarea[name="message"], textarea[name="pr"]');
      if (commentInput) await commentInput.fill(therapist.comment);
    }

    // 写真のアップロード
    if (therapist.photo_url) {
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        const tmpImagePath = await downloadImageToTemp(therapist.photo_url, 'mens_');
        if (tmpImagePath) {
          await fileInput.setInputFiles(tmpImagePath);
          setTimeout(() => fs.unlink(tmpImagePath, () => {}), 5000);
        }
      }
    }

    // 保存ボタンをクリック
    const saveButton = await page.$('button[type="submit"], input[type="submit"], .btn-primary, button:has-text("保存"), button:has-text("登録")');
    if (saveButton) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        saveButton.click()
      ]);
    }
    
    // 新規登録の場合、IDを取得するためにURLや一覧ページを確認する
    let newId = rankingTherapistId;
    if (isNew) {
      // 一覧へ行ってIDを取得
      await page.goto('https://www.esthe-ranking.jp/shop/therapist/', { waitUntil: 'domcontentloaded' });
      // href="/shop/therapist/edit/12345/" のようなリンクを探す
      const firstLink = await page.$('a[href*="/shop/therapist/edit/"]');
      if (firstLink) {
        const href = await firstLink.getAttribute('href');
        const m = href?.match(/\/edit\/(\d+)/);
        if (m && m[1]) newId = m[1];
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
