import { getBrowser } from './browser';

export interface SyncResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * メンズエステランキングのログインページを開く。ログインフォームが現れるまでリトライする。
 *
 * このサイトはbot検知（WAF）により断続的に 403 Forbidden を返す。実測で約3回に1回。
 * 従来はその場で page.fill がタイムアウトして同期全体が失敗していたため、
 * 少し待って開き直すことで大半を救済する。
 * 全ての呼び出し口（シフト同期・セラピスト一覧取得・プロフィール送信）はこの関数を使うこと。
 */
export async function openEstheRankingLoginPage(
  page: any,
  shopUrl: string,
  maxAttempts = 3
): Promise<void> {
  const targetUrl = shopUrl || 'https://www.esthe-ranking.jp/login/';
  let lastIssue = '不明';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await page
      .goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
      .catch((e: any) => {
        lastIssue = e?.message || 'ページを開けませんでした';
        return null;
      });

    // ログインフォームが描画されていれば成功
    const loginInput = await page.$('input[name="loginname"]').catch(() => null);
    if (loginInput) {
      if (attempt > 1) console.log(`[EstheRankingSync] ログインページを${attempt}回目で開けました。`);
      return;
    }

    const status = typeof response?.status === 'function' ? response.status() : null;
    const title = await page.title().catch(() => 'unknown');
    lastIssue = `HTTP ${status ?? '不明'} / 画面タイトル: ${title}`;

    if (attempt < maxAttempts) {
      const waitMs = 3000 * attempt; // 3秒 → 6秒 と待ち時間を延ばす
      console.warn(`[EstheRankingSync] ログインページを開けず再試行します (${attempt}/${maxAttempts}): ${lastIssue}`);
      await page.waitForTimeout(waitMs);
    }
  }

  throw new Error(
    `メンズエステランキングのログインページを開けませんでした（${maxAttempts}回試行）。` +
    `サイト側のアクセス制限(403)の可能性があります。最終状態: ${lastIssue}`
  );
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
    await page.route('**/*', (route: any) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font', 'websocket'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // 1. ログイン画面へのアクセス（403対策のリトライ込み）
    await openEstheRankingLoginPage(page, shopUrl);

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
      try { await Promise.all(browser.contexts().map((c: any) => c.close())); } catch(e){} 
        await browser.close();
        await new Promise(resolve => setTimeout(resolve, 500));
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
    let h = parseInt(match[1], 10);
    if (h >= 24) h -= 24;
    const hStr = String(h).padStart(2, '0');
    return `${hStr}:${match[2]}`;
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
    await openEstheRankingLoginPage(page, shopUrl);
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

function normalizeTherapistName(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase();
}

/**
 * ポータル側に既にプロフィールが存在するキャストを名前で探す。
 * 新規登録前にこれを挟むことで、同名の重複プロフィール作成を防ぐ。
 * 見つからない・取得に失敗した場合はnullを返す（呼び出し側は新規登録にフォールバックする）。
 */
export async function findExistingRankingIdByName(
  shopUrl: string,
  loginId: string,
  password: string,
  therapistName: string
): Promise<string | null> {
  try {
    const portalTherapists = await fetchTherapistsFromEstheRanking(shopUrl, loginId, password);
    const normalized = normalizeTherapistName(therapistName);
    const match = portalTherapists.find(t => normalizeTherapistName(t.name) === normalized);
    return match ? match.id : null;
  } catch (e) {
    console.error('[EstheRankingSync] findExistingRankingIdByName failed:', e);
    return null;
  }
}

