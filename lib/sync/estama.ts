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
    console.log('[EstamaSync] Dynamically importing playwright-core and @sparticuz/chromium...');
    const { chromium: playwrightCore } = await import('playwright-core');
    const chromium = (await import('@sparticuz/chromium')).default;
    
    // Serverless環境用に設定最適化（メモリ節約等）
    chromium.setGraphicsMode = false;

    console.log('[EstamaSync] Launching playwrightCore...');
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
 * 出勤情報および案内状況をエステ魂へ同期する
 */
export async function syncShiftsToEstama(
  shopUrl: string,
  loginId: string,
  password: string,
  startDate: string,
  endDate: string,
  shifts: any[],
  reservations: any[] = []
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

    // 不要な画像・フォント・メディア等のリソース読み込みを遮断してメモリ消費と接続数を削減
    await page.route('**/*', (route: any) => {
      const type = route.request().resourceType();
      if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    const targetShopUrl = shopUrl || 'https://estama.jp/login/?r=/admin/';

    // 1. ログイン画面アクセス
    console.log(`[EstamaSync] Navigating to ${targetShopUrl}`);
    await page.goto(targetShopUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(async (e: any) => {
      console.warn(`[EstamaSync] Primary URL failed, retrying https://estama.jp/login/ ...`, e);
      await page.goto('https://estama.jp/login/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    });

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

    // 対象となるセラピストID（エステ魂側ID）のリストを作成
    const targetTherapists = [...new Set(shifts.map(s => s.therapists?.estama_therapist_id).filter(id => !!id))] as string[];

    console.log(`[EstamaSync] Syncing ${targetTherapists.length} therapists for Estama...`);

    for (const estamaId of targetTherapists) {
      console.log(`[EstamaSync] Processing therapist ${estamaId}`);
      
      const therapistShifts = shifts.filter(s => s.therapists?.estama_therapist_id === estamaId);
      // セラピストの内部IDを取得して予約を絞り込む
      const internalTherapistId = therapistShifts[0]?.therapists?.id;
      const therapistReservations = reservations ? reservations.filter(r => r.therapist_id === internalTherapistId) : [];

      // スケジュール設定ページヘの遷移
      const scheduleUrl = `https://estama.jp/admin/schedule/${estamaId}/`;
      await page.goto(scheduleUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

      // JSで動的にテーブルを解析して入力する
      await page.evaluate(({ shifts, reservations }: { shifts: any[], reservations: any[] }) => {
        const timeToMins = (t: string) => {
          if (!t) return 0;
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
        };

        const triggerChange = (el: HTMLSelectElement) => {
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const dateMap: { [key: string]: any } = {};
        shifts.forEach((s: any) => {
          const d = new Date(s.date);
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const mmdd = `${mm}/${dd}`;
          dateMap[mmdd] = {
            shift: s,
            res: reservations.filter((r: any) => r.date === s.date)
          };
        });

        const headers = document.querySelectorAll('th');
        const cols: { [key: number]: any } = {};
        headers.forEach(th => {
          const match = th.textContent?.match(/(\d{1,2})\/(\d{1,2})/);
          if (match) {
            const m = match[1].padStart(2, '0');
            const d = match[2].padStart(2, '0');
            const mmdd = `${m}/${d}`;
            if (dateMap[mmdd]) {
              cols[th.cellIndex] = dateMap[mmdd];
            }
          }
        });

        const trs = document.querySelectorAll('tr');
        trs.forEach(tr => {
          const timeTh = tr.querySelector('th');
          const timeMatch = timeTh ? timeTh.textContent?.match(/(\d{1,2}):(\d{2})/) : null;
          
          if (timeMatch) {
            // 30分枠の行
            const rowMins = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
            
            Array.from(tr.cells).forEach(cell => {
              const colData = cols[cell.cellIndex];
              if (colData && colData.shift) {
                const select = cell.querySelector('select');
                if (select) {
                  const sStart = timeToMins(colData.shift.start_time);
                  const sEnd = timeToMins(colData.shift.end_time);
                  
                  if (rowMins >= sStart && rowMins < sEnd) {
                    // 出勤時間内：予約チェック
                    const isReserved = colData.res.some((r: any) => {
                      const rStart = timeToMins(r.start_time);
                      const rEnd = timeToMins(r.end_time);
                      // 30分枠と予約枠の重複判定
                      return rowMins < rEnd && (rowMins + 30) > rStart;
                    });
                    
                    const targetStatus = isReserved ? '×' : '○';
                    
                    for (const opt of Array.from(select.options)) {
                      // 記号揺れや表記揺れを考慮
                      const t = opt.text;
                      if (
                        t.includes(targetStatus) || 
                        (targetStatus === '×' && (t.includes('x') || t.includes('✕') || t.includes('空きなし'))) ||
                        (targetStatus === '○' && (t.includes('受付中') || t === '〇'))
                      ) {
                        if (select.value !== opt.value) {
                          select.value = opt.value;
                          triggerChange(select);
                        }
                        break;
                      }
                    }
                  } else {
                    // 出勤時間外は基本触らない、あるいは「-」や「お休み」にする
                    // 今回は既存のままにする
                  }
                }
              }
            });
          } else {
            // 時間枠以外の行（出退勤時刻など）
            Array.from(tr.cells).forEach(cell => {
              const colData = cols[cell.cellIndex];
              if (colData && colData.shift) {
                const selects = cell.querySelectorAll('select');
                // 最低2つあれば出勤・退勤とみなす
                if (selects.length >= 2) {
                  const sStart = colData.shift.start_time.substring(0, 5); // "13:00"
                  const sEnd = colData.shift.end_time.substring(0, 5);
                  
                  [ {sel: selects[0], val: sStart}, {sel: selects[1], val: sEnd} ].forEach(({sel, val}) => {
                    for (const opt of Array.from(sel.options)) {
                      if (opt.text.includes(val) || opt.value.includes(val)) {
                        if (sel.value !== opt.value) {
                          sel.value = opt.value;
                          triggerChange(sel);
                        }
                        break;
                      }
                    }
                  });
                }
              }
            });
          }
        });
      }, { shifts: therapistShifts, reservations: therapistReservations });

      // 保存ボタンの実行（"出勤情報を保存する" などのボタン）
      const saveBtn = await page.$('button:has-text("保存"), input[value*="保存"], a:has-text("保存"), .btn-save, .btn-primary, form button[type="submit"]');
      if (saveBtn) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
          saveBtn.click()
        ]);
        // 非同期保存（AJAX）の可能性も考慮して少し待機
        await page.waitForTimeout(2000);
      } else {
        console.warn(`[EstamaSync] 保存ボタンが見つかりませんでした (therapist: ${estamaId})`);
      }
    }

    return { success: true, message: 'エステ魂への出勤情報・予約状況(×)の同期が完了しました。' };
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

    // 不要な画像・フォント・メディア等のリソース読み込みを遮断
    await page.route('**/*', (route: any) => {
      const type = route.request().resourceType();
      if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    const targetShopUrl = shopUrl || 'https://estama.jp/login/?r=/admin/';
    await page.goto(targetShopUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(async (e: any) => {
      console.warn(`[EstamaSync] Primary URL failed, retrying https://estama.jp/login/ ...`, e);
      await page.goto('https://estama.jp/login/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    });

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
