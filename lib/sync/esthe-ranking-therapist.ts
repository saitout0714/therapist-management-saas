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
    console.log('[EstheRankingTherapistSync] Dynamically importing playwright-core and @sparticuz/chromium...');
    const { chromium: playwrightCore } = await import('playwright-core');
    const chromium = (await import('@sparticuz/chromium')).default;
    
    chromium.setGraphicsMode = false;

    console.log('[EstheRankingTherapistSync] Launching playwrightCore...');
    return await playwrightCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
}

export async function syncTherapistToEstheRanking(
  shopUrl: string,
  loginId: string,
  password: string,
  therapist: any,
  rankingTherapistId: string | null
): Promise<{ success: boolean; newId?: string; error?: string }> {
  let browser;
  try {
    browser = await getBrowser();
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // 1. Login
    const targetLoginUrl = shopUrl || 'https://www.esthe-ranking.jp/login/';
    await page.goto(targetLoginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(async () => {
      await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
    
    try {
      await uploadDebugScreenshot(page, 'er_after_login');
      await page.fill('input[name="loginname"]', loginId);
      await page.fill('input[name="password"]', password);
      
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.click('form[action="/login/"] button[type="submit"]')
      ]);
    } catch (e) {
      throw new Error('メンズエステランキングのログイン入力項目が見つかりませんでした。');
    }

    // 2. Navigate to Edit / Create page
    let isNew = false;
    let editUrl = 'https://www.esthe-ranking.jp/shop/therapist/add/';
    if (rankingTherapistId) {
      editUrl = `https://www.esthe-ranking.jp/shop/therapist/edit/${rankingTherapistId}/`;
    } else {
      isNew = true;
    }

    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

    if (page.url().includes('/login')) {
      throw new Error('メンズエステランキングのログインに失敗しました。認証情報を確認してください。');
    }
    
    // 3. Fill the form
    // 名前
    const nameInput = await page.$('input[name="nickname"], input[name="name"], input[name="cast_name"]');
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

    // 基本プロフィールの保存ボタンをクリック
    try {
      const saveButton = page.locator('button:has-text("この内容で保存"), button:has-text("保存"), button:has-text("登録"), button[type="submit"], input[type="submit"]').first();
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        saveButton.click({ force: true, timeout: 5000 }).catch(() => page.evaluate(() => {
          const forms = Array.from(document.querySelectorAll('form'));
          const targetForm = forms.find(f => f.innerText.includes('保存') || f.innerText.includes('登録') || f.action.includes('detail')) || forms[forms.length - 1];
          if (targetForm) targetForm.submit();
        }))
      ]);
    } catch (e) {
      console.error('Failed to click save button:', e);
    }

    // 新規登録・更新後のID確定と写真アップロード
    let newId = rankingTherapistId;
    if (isNew) {
      const afterUrl = page.url();
      const match = afterUrl.match(/\/(?:detail|edit)\/(\d+)/);
      if (match && match[1]) {
        newId = match[1];
      } else {
        await page.goto('https://www.esthe-ranking.jp/shop/image/girl/upload/all/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        // 名前で対象行を探し、その行の編集リンクからIDを取得
        const link = await page.$(`tr:has-text("${therapist.name}") a[href*="/upload/detail/"]`);
        if (link) {
          const href = await link.getAttribute('href');
          const m = href?.match(/\/detail\/(\d+)/);
          if (m && m[1]) newId = m[1];
        }
      }
    }

    // 写真のアップロード (detail/{id}/ ページで専用フォーム `form[action*="change_file"]` からアップロード)
    const targetGirlId = newId || rankingTherapistId;
    const photoUrls = therapist.photo_urls || (therapist.photos ? therapist.photos.map((p: any) => p.photo_url) : (therapist.photo_url ? [therapist.photo_url] : []));

    if (targetGirlId && photoUrls.length > 0) {
      try {
        const photoDetailUrl = `https://www.esthe-ranking.jp/shop/image/girl/upload/detail/${targetGirlId}/`;
        if (page.url() !== photoDetailUrl) {
          await page.goto(photoDetailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        }

        await uploadDebugScreenshot(page, 'er_before_photo');
        let uploadedAny = false;
        
        // Delete existing photos first to ensure we can upload new ones and avoid stale photos
        while (true) {
          const formNames = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("a.btn-danger")).map(a => {
              const match = a.getAttribute("onclick")?.match(/document\.(post_[^.]+)\.submit/);
              return match ? match[1] : null;
            }).filter(Boolean) as string[];
          });
          
          if (formNames.length === 0) break;
          
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
            page.evaluate(`document["${formNames[0]}"].submit()`)
          ]);
        }
        
        for (let i = 0; i < Math.min(photoUrls.length, 3); i++) {
          const url = photoUrls[i];
          if (!url) continue;
          const fileInput = await page.$(`input[name="file[${i + 1}]"]`);
          if (fileInput) {
            const tmpImagePath = await downloadImageToTemp(url, `er_img_${i}_`, page);
            if (tmpImagePath) {
              await fileInput.setInputFiles(tmpImagePath);
              uploadedAny = true;
              setTimeout(() => fs.unlink(tmpImagePath, () => {}), 10000);
            }
          }
        }

        if (uploadedAny) {
          await uploadDebugScreenshot(page, 'er_before_save');
          
          // ER uses "画像アップロード" button to submit the form
          const uploadBtn = await page.$('button:has-text("画像アップロード")');
          if (uploadBtn) {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
              uploadBtn.click()
            ]);
          } else {
            // Fallback just in case
            const fallbackBtn = await page.$('button[type="submit"]');
            if (fallbackBtn) {
              await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
                fallbackBtn.click()
              ]);
            }
          }
          
          await uploadDebugScreenshot(page, 'er_after_save');
        }
      } catch (e) {
        console.error('Failed to upload photos to Esthe Ranking:', e);
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
