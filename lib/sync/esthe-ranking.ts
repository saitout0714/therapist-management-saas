import { chromium as playwrightLocal } from 'playwright';

const CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-zygote',
  '--single-process',
  '--disable-gpu',
];

async function getBrowser() {
  const isLocal = !!process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.NODE_ENV === 'development' || !process.env.VERCEL;

  if (isLocal) {
    return await playwrightLocal.launch({
      headless: true,
      args: CHROMIUM_ARGS,
    });
  } else {
    // Vercel Serverless Function 等での実行用
    console.log('[EstheRankingSync] Dynamically importing playwright-core and @sparticuz/chromium...');
    const { chromium: playwrightCore } = await import('playwright-core');
    const chromium = (await import('@sparticuz/chromium')).default;
    
    // Serverless環境用に設定最適化（メモリ節約等）
    chromium.setGraphicsMode = false;

    console.log('[EstheRankingSync] Launching playwrightCore...');
    return await playwrightCore.launch({
      args: chromium.args, // @sparticuz/chromium の推奨設定をそのまま使う
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
 * 出勤情報をメンズエステランキングへ同期する
 * @param shopUrl 管理画面URL
 * @param loginId ログインID
 * @param password パスワード
 * @param startDate 同期開始日 (YYYY-MM-DD)
 * @param endDate 同期終了日 (YYYY-MM-DD)
 * @param shifts 同期するシフトデータ (全日分)
 */
export async function syncShiftsToEstheRanking(
  shopUrl: string,
  loginId: string,
  password: string,
  startDate: string,
  endDate: string,
  shifts: any[]
): Promise<SyncResult> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  try {
    console.log(`[EstheRankingSync] Starting sync from ${startDate} to ${endDate}`);
    
    // リソースをブロックしてメモリ消費を抑える（stylesheetはスクリプト・レイアウト破壊を防ぐためブロック対象外）
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font', 'websocket'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // 1. ログイン画面へのアクセス
    await page.goto(shopUrl, { timeout: 10000 });
    
    // 2. ログイン処理
    await page.fill('input[name="loginname"]', loginId);
    await page.fill('input[name="password"]', password);
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      page.click('form[action="/login/"] button[type="submit"]')
    ]);

    // ログイン成功確認（エラーメッセージ等のチェック）
    const loginError = await page.$('.alert-danger, .error-message');
    if (loginError) {
      const errorText = await loginError.textContent();
      throw new Error(`ログインに失敗しました: ${errorText?.trim()}`);
    }

    // 期間内の日付を配列で生成 (タイムゾーンに影響されないようUTCメソッドを使用)
    const datesToSync: string[] = [];
    const current = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    
    // 無限ループ防止のため最大31日に制限
    let safetyCounter = 0;
    while (current <= end && safetyCounter < 31) {
      const yyyy = current.getUTCFullYear();
      const mm = String(current.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(current.getUTCDate()).padStart(2, '0');
      datesToSync.push(`${yyyy}-${mm}-${dd}`);
      current.setUTCDate(current.getUTCDate() + 1);
      safetyCounter++;
    }

    console.log(`[EstheRankingSync] Syncing ${datesToSync.length} days...`);

    for (const currentDate of datesToSync) {
      console.log(`[EstheRankingSync] Processing ${currentDate}`);
      
      const targetUrl = `https://www.esthe-ranking.jp/shop/schedule/${currentDate}/`;
      
      // ページ移動のリトライ処理
      let navigated = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          navigated = true;
          break;
        } catch (gotoErr: any) {
          console.warn(`[EstheRankingSync] page.goto attempt ${attempt} failed for ${currentDate}: ${gotoErr?.message}`);
          if (attempt === 1) {
            await page.waitForTimeout(1000);
          } else {
            throw gotoErr;
          }
        }
      }

      // フォームがレンダリングされるまで少し待機
      await page.waitForSelector(`form[action="/shop/schedule/${currentDate}/"]`, { timeout: 10000 }).catch(() => {});

      const scheduleForm = await page.$(`form[action="/shop/schedule/${currentDate}/"]`);
      if (!scheduleForm) {
        console.warn(`対象日(${currentDate})のスケジュールフォームが見つかりませんでした。スキップします。`);
        continue;
      }

      // ページ上のすべてのセラピストIDを取得
      const idInputs = await page.$$('input[name$="[id]"]');
      const therapistIdsOnPage = [];
      for (const input of idInputs) {
        const name = await input.getAttribute('name');
        if (name) {
          const match = name.match(/^(\d+)\[id\]$/);
          if (match) {
            therapistIdsOnPage.push(match[1]);
          }
        }
      }

      // その日のシフトのみを抽出
      const todayShifts = shifts.filter(s => s.date === currentDate);

      for (const rankingId of therapistIdsOnPage) {
        const shift = todayShifts.find(s => s.therapists?.esthe_ranking_therapist_id === rankingId);

        if (shift) {
          // 出勤として設定
          const startTime = formatTime(shift.start_time);
          const endTime = formatTime(shift.end_time);
          
          await page.selectOption(`select[name="${rankingId}[start_work]"]`, startTime).catch(() => {});
          await page.selectOption(`select[name="${rankingId}[end_work]"]`, endTime).catch(() => {});
          
          // 「出勤時間未定」チェックボックスがオンの場合は解除する
          const isTimeNotSetCheckbox = await page.$(`input[type="checkbox"][name="${rankingId}[is_time_not_set]"]`);
          if (isTimeNotSetCheckbox) {
            const isChecked = await isTimeNotSetCheckbox.isChecked().catch(() => false);
            if (isChecked) {
              await isTimeNotSetCheckbox.uncheck().catch(() => {});
            }
          }

          const deleteFlagCheckbox = await page.$(`input[type="checkbox"][name="${rankingId}[delete_flag]"]`);
          if (deleteFlagCheckbox) {
            await deleteFlagCheckbox.uncheck();
          }
        } else {
          // 出勤解除または未設定にする
          const deleteFlagCheckbox = await page.$(`input[type="checkbox"][name="${rankingId}[delete_flag]"]`);
          if (deleteFlagCheckbox) {
            await deleteFlagCheckbox.check();
          } else {
            await page.selectOption(`select[name="${rankingId}[start_work]"]`, '0').catch(() => {});
            await page.selectOption(`select[name="${rankingId}[end_work]"]`, '0').catch(() => {});
          }
        }
      }

      // 保存ボタンをクリックし、ナビゲーションを待つ
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.click('form button.btn-success[type="submit"]')
      ]);
      await page.waitForTimeout(500);
    }


    console.log(`[EstheRankingSync] Sync completed successfully.`);
    return { success: true, message: 'メンズエステランキングへの出勤情報同期が完了しました。' };
  } catch (error: any) {
    const pageTitle = await page.title().catch(() => 'unknown');
    const pageUrl = page.url();
    console.error('[EstheRankingSync] Error:', error, 'Page Title:', pageTitle, 'URL:', pageUrl);
    return { success: false, error: `${error.message} (画面タイトル: ${pageTitle}, URL: ${pageUrl})` };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * データベースの時刻フォーマット (HH:MM:SS等) をセレクトボックスの形式 (HH:MM) に合わせる
 */
function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '0';
  const match = timeStr.match(/^(\d{2}):(\d{2})/);
  if (match) {
    // セレクトボックスに存在するオプション形式 (HH:MM または HH:MM(XX:XX) などだが valueは HH:MM)
    // 00:00〜05:30の場合、オプションのvalueはそのまま00:00等になっている
    return `${match[1]}:${match[2]}`;
  }
  return '0';
}

/**
 * メンズエステランキングからセラピスト一覧を取得する
 */
export async function fetchTherapistsFromEstheRanking(
  shopUrl: string,
  loginId: string,
  password: string
): Promise<{ id: string; name: string }[]> {
  let browser: any;
  let page: any;
  try {
    console.log(`[EstheRankingSync] Launching browser...`);
    browser = await getBrowser();
    console.log(`[EstheRankingSync] Creating browser context...`);
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });
    page = await context.newPage();
 
    console.log(`[EstheRankingSync] Fetching therapists...`);
    
    console.log(`[EstheRankingSync] Navigating to ${shopUrl}...`);
    await page.goto(shopUrl, { timeout: 10000 });
    console.log(`[EstheRankingSync] Filling login credentials...`);
    await page.fill('input[name="loginname"]', loginId);
    await page.fill('input[name="password"]', password);
    console.log(`[EstheRankingSync] Submitting login form...`);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch((e: any) => {
        console.warn(`[EstheRankingSync] Login navigation timed out:`, e);
      }),
      page.click('form[action="/login/"] button[type="submit"]')
    ]);
 
    console.log(`[EstheRankingSync] Checking for login errors...`);
    const loginError = await page.$('.alert-danger, .error-message');
    if (loginError) {
      const errorText = await loginError.textContent();
      console.error(`[EstheRankingSync] Login failed:`, errorText);
      throw new Error(`ログインに失敗しました: ${errorText?.trim()}`);
    }
    console.log(`[EstheRankingSync] Login successful!`);

    // 本日の日付のスケジュールページへ遷移 (確実にリストを取得するため)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    const targetUrl = `https://www.esthe-ranking.jp/shop/schedule/${dateStr}/`;
    console.log(`[EstheRankingSync] Navigating to schedule page: ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log(`[EstheRankingSync] Waiting for table rows...`);
    await page.waitForSelector('tr.tr-admin-linkcheck', { timeout: 10000 }).catch((e: any) => {
      console.warn(`[EstheRankingSync] Table selector timed out:`, e);
    });
    console.log(`[EstheRankingSync] Scraping table rows...`);

    // テーブル行からIDと名前を抽出
    const therapists = await page.$$eval('tr.tr-admin-linkcheck', (rows: any[]) => {
      return rows.map((tr: any) => {
        const id = tr.getAttribute('data-girl-id') || '';
        // 2番目のtdの中にあるspanを探す
        const nameSpan = tr.querySelector('td:nth-child(2) span');
        const name = nameSpan ? nameSpan.textContent?.trim() || '' : '';
        return { id, name };
      }).filter((t: any) => t.id && t.name);
    });

    console.log(`[EstheRankingSync] Found ${therapists.length} therapists on portal.`);
    return therapists;
  } catch (error: any) {
    const pageTitle = page ? await page.title().catch(() => 'unknown') : 'unknown';
    const pageUrl = page ? page.url() : 'unknown';
    console.error('[EstheRankingSync] Error fetching therapists:', error, 'Page Title:', pageTitle, 'URL:', pageUrl);
    throw new Error(`${error.message} (画面タイトル: ${pageTitle}, URL: ${pageUrl})`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

