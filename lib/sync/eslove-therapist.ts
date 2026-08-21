import { downloadImageToTemp } from './download-image';
import fs from 'fs';
import { loginToEslove } from './eslove';
import { getBrowser } from './browser';

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
    browser = await getBrowser({ useRelay: true });

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

    // 4. 新規登録の場合、保存後のURLまたは一覧ページから「名前が一致する」IDを取得する。
    //    ※かつては一覧の先頭リンクのIDを使っていたが、それだと全く無関係の既存キャストの
    //      プロフィールに紐付いてしまい、次回同期でそのキャストを上書きしてしまう。
    //      名前で特定できない場合はエラーにして、誤った紐付けを作らない。
    let newId = esloveTherapistId;
    if (isNew) {
      const afterUrl = page.url();
      const match = afterUrl.match(/\/therapist\/edit\/(\d+)/);
      if (match && match[1]) {
        newId = match[1];
      } else {
        await page.goto('https://eslove.jp/admin/shop/therapist', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        await page.waitForSelector('a[href*="/therapist/edit/"]', { timeout: 15000 }).catch(() => {});

        const targetName = (therapist.name || '').replace(/\s+/g, '').toLowerCase();
        const portalEntries: { id: string; name: string }[] = await page.evaluate(() => {
          const list: { id: string; name: string }[] = [];
          document.querySelectorAll('a[href*="/therapist/edit/"]').forEach(a => {
            const m = (a.getAttribute('href') || '').match(/\/therapist\/edit\/(\d+)/);
            const name = (a.textContent || '').trim();
            if (m && name) list.push({ id: m[1], name });
          });
          return list;
        });

        const foundId = portalEntries.find(
          e => e.name.replace(/\s+/g, '').toLowerCase() === targetName
        )?.id || null;

        if (!foundId) {
          throw new Error(`エステラブへの新規登録後、「${therapist.name}」のプロフィールを一覧から特定できませんでした。エステラブ側の入力チェックで保存が拒否された可能性があります（名前に使用できない文字が含まれていないかご確認ください）。`);
        }
        newId = foundId;
      }
    }

    // 5. 写真のアップロード（画像登録タブ）
    const photoUrls: string[] = therapist.photo_urls || (therapist.photos ? therapist.photos.map((p: any) => p.photo_url) : (therapist.photo_url ? [therapist.photo_url] : []));
    if (newId && photoUrls.length > 0) {
      const tmpPaths: string[] = [];
      try {
        await page.goto(`https://eslove.jp/admin/shop/therapist_image/${newId}`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        // ファイル選択欄はCSSで隠されているため state:'attached' で待つ（既定の可視待ちだと必ずタイムアウトする）
        await page.waitForSelector('#therapistImageUpload, input[type="file"]', { state: 'attached', timeout: 15000 }).catch(() => {});

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
