import { chromium as playwrightLocal } from 'playwright';

async function getBrowser() {
  const isLocal = !!process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.NODE_ENV === 'development' || !process.env.VERCEL;

  if (isLocal) {
    return await playwrightLocal.launch({ headless: true });
  } else {
    console.log('[EstamaSync] Dynamically importing playwright-core and @sparticuz/chromium...');
    const { chromium: playwrightCore } = await import('playwright-core');
    const chromium = (await import('@sparticuz/chromium')).default;
    
    console.log('[EstamaSync] Launching playwrightCore...');
    return await playwrightCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
}

export interface SyncResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 出勤情報および案内状況をエステ魂へ同期する
 */
export async function syncShiftsToEstama(
  shopUrl: string,
  loginId: string,
  password: string,
  startDate: string,
  endDate: string,
  shifts: any[]
): Promise<SyncResult> {
  let browser: any;
  let page: any;

  try {
    console.log(`[EstamaSync] Starting shift & guidance status sync from ${startDate} to ${endDate}`);
    browser = await getBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });
    page = await context.newPage();

    const targetShopUrl = shopUrl || 'https://estama.jp/login/?r=/admin/';

    // 1. ログイン画面アクセス
    console.log(`[EstamaSync] Navigating to ${targetShopUrl}`);
    await page.goto(targetShopUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // 2. ログイン処理
    const loginInput = await page.$('input[name="loginname"], input[name="username"], input[name="mail"], input[name="email"], input[type="text"], input[type="email"]');
    const passInput = await page.$('input[name="password"], input[type="password"]');

    if (loginInput && passInput) {
      await loginInput.fill(loginId);
      await passInput.fill(password);

      const submitButton = await page.$('button[type="submit"], input[type="submit"], form button, .login-btn');
      if (submitButton) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
          submitButton.click()
        ]);
      } else {
        await page.keyboard.press('Enter');
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      }
    }

    // ログインエラーチェック
    const loginError = await page.$('.alert-danger, .error-message, .error, .alert');
    if (loginError) {
      const errorText = await loginError.textContent();
      if (errorText && (errorText.includes('失敗') || errorText.includes('エラー') || errorText.includes('間違'))) {
        throw new Error(`エステ魂ログインに失敗しました: ${errorText.trim()}`);
      }
    }

    // 期間内の日付を配列生成
    const datesToSync: string[] = [];
    const current = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    let safetyCounter = 0;
    while (current <= end && safetyCounter < 31) {
      const yyyy = current.getUTCFullYear();
      const mm = String(current.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(current.getUTCDate()).padStart(2, '0');
      datesToSync.push(`${yyyy}-${mm}-${dd}`);
      current.setUTCDate(current.getUTCDate() + 1);
      safetyCounter++;
    }

    console.log(`[EstamaSync] Syncing ${datesToSync.length} days for Estama...`);

    for (const currentDate of datesToSync) {
      console.log(`[EstamaSync] Processing date ${currentDate}`);
      // スケジュール設定ページヘの遷移
      const scheduleUrl = `https://estama.jp/admin/schedule/${currentDate}/`;
      await page.goto(scheduleUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});

      const todayShifts = shifts.filter(s => s.date === currentDate);

      // ページ内のセラピストID要素・フォームを検索して出勤・案内状況をセット
      const idInputs = await page.$$('input[name$="[id]"], tr[data-girl-id], input[name*="therapist_id"]');
      for (const input of idInputs) {
        const estamaId = (await input.getAttribute('data-girl-id')) || (await input.getAttribute('value')) || '';
        if (!estamaId) continue;

        const shift = todayShifts.find(s => s.therapists?.estama_therapist_id === estamaId);
        if (shift) {
          const startTime = formatTime(shift.start_time);
          const endTime = formatTime(shift.end_time);

          // 1. 出勤時刻・退勤時刻の設定
          await page.selectOption(`select[name="${estamaId}[start_work]"], select[name="start_${estamaId}"]`, startTime).catch(() => {});
          await page.selectOption(`select[name="${estamaId}[end_work]"], select[name="end_${estamaId}"]`, endTime).catch(() => {});

          // 2. 案内状況（status / guide_status）の設定
          // シフトデータ内に status / guidance_status の指定がある場合、またはデフォルト動作
          const statusVal = shift.guidance_status || shift.status || '1'; // 例: 1=即ご案内, 2=時間指定, etc.
          await page.selectOption(
            `select[name="${estamaId}[status]"], select[name="${estamaId}[guide_status]"], select[name="status_${estamaId}"]`,
            statusVal
          ).catch(() => {});
        } else {
          // お休みの場合
          const deleteCheckbox = await page.$(`input[type="checkbox"][name="${estamaId}[delete_flag]"], input[type="checkbox"][name="${estamaId}[off]"]`);
          if (deleteCheckbox) {
            await deleteCheckbox.check().catch(() => {});
          } else {
            await page.selectOption(`select[name="${estamaId}[start_work]"], select[name="start_${estamaId}"]`, '0').catch(() => {});
            await page.selectOption(`select[name="${estamaId}[end_work]"], select[name="end_${estamaId}"]`, '0').catch(() => {});
          }
        }
      }

      // 保存ボタンの実行
      const saveBtn = await page.$('form button[type="submit"], input[type="submit"][value*="保存"], button.btn-save');
      if (saveBtn) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {}),
          saveBtn.click()
        ]);
      }
    }

    return { success: true, message: 'エステ魂への出勤情報・案内状況の同期が完了しました。' };
  } catch (error: any) {
    const pageTitle = page ? await page.title().catch(() => 'unknown') : 'unknown';
    const pageUrl = page ? page.url() : 'unknown';
    console.error('[EstamaSync] Error:', error, 'Page Title:', pageTitle, 'URL:', pageUrl);
    return { success: false, error: `${error.message} (画面タイトル: ${pageTitle}, URL: ${pageUrl})` };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * エステ魂からセラピスト一覧を取得する
 */
export async function fetchTherapistsFromEstama(
  shopUrl: string,
  loginId: string,
  password: string
): Promise<{ id: string; name: string }[]> {
  let browser: any;
  let page: any;
  try {
    console.log(`[EstamaSync] Fetching therapists from Estama...`);
    browser = await getBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });
    page = await context.newPage();

    const targetShopUrl = shopUrl || 'https://estama.jp/login/?r=/admin/';
    await page.goto(targetShopUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const loginInput = await page.$('input[name="loginname"], input[name="username"], input[name="mail"], input[name="email"], input[type="text"], input[type="email"]');
    const passInput = await page.$('input[name="password"], input[type="password"]');

    if (loginInput && passInput) {
      await loginInput.fill(loginId);
      await passInput.fill(password);

      const submitButton = await page.$('button[type="submit"], input[type="submit"], form button, .login-btn');
      if (submitButton) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
          submitButton.click()
        ]);
      } else {
        await page.keyboard.press('Enter');
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      }
    }

    const loginError = await page.$('.alert-danger, .error-message, .error');
    if (loginError) {
      const errorText = await loginError.textContent();
      if (errorText && (errorText.includes('失敗') || errorText.includes('エラー') || errorText.includes('間違'))) {
        throw new Error(`エステ魂ログインに失敗しました: ${errorText.trim()}`);
      }
    }

    // 本日のスケジュール / セラピスト一覧ページへ
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const scheduleUrl = `https://estama.jp/admin/schedule/${dateStr}/`;
    await page.goto(scheduleUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});

    // テーブル行やリスト要素からセラピスト情報を抽出
    const therapists = await page.$$eval('tr.tr-admin-linkcheck, tr[data-girl-id], .therapist-item, table tbody tr', (rows: any[]) => {
      return rows.map((tr: any) => {
        const id = tr.getAttribute('data-girl-id') || tr.querySelector('input[name*="id"]')?.value || tr.querySelector('a')?.getAttribute('href')?.match(/\d+/)?.[0] || '';
        const nameSpan = tr.querySelector('td:nth-child(2) span') || tr.querySelector('.name') || tr.querySelector('td:nth-child(2)');
        const name = nameSpan ? nameSpan.textContent?.trim() || '' : '';
        return { id, name };
      }).filter((t: any) => t.id && t.name);
    });

    console.log(`[EstamaSync] Found ${therapists.length} therapists on Estama portal.`);
    return therapists;
  } catch (error: any) {
    const pageTitle = page ? await page.title().catch(() => 'unknown') : 'unknown';
    const pageUrl = page ? page.url() : 'unknown';
    console.error('[EstamaSync] Error fetching therapists:', error, 'Page Title:', pageTitle, 'URL:', pageUrl);
    throw new Error(`${error.message} (画面タイトル: ${pageTitle}, URL: ${pageUrl})`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '0';
  const match = timeStr.match(/^(\d{2}):(\d{2})/);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }
  return '0';
}
