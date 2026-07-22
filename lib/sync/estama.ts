import { chromium as playwrightLocal } from 'playwright';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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
  reservations: any[] = [],
  activeTherapists: any[] = []
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

      const submitButton = await page.$('button[type="submit"], input[type="submit"], form button, .login-btn, a[type="submit"], a.send-post');
      if (submitButton) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
          submitButton.click()
        ]);
      } else {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
          page.keyboard.press('Enter')
        ]);
      }
    }

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      const loginError = await page.$('.alert-danger, .error-message, .error, .validation-error');
      let errorMsg = '不明なエラー';
      if (loginError) {
        errorMsg = await loginError.textContent() || errorMsg;
      }
      throw new Error(`エステ魂ログインに失敗しました。認証情報が間違っているか、アクセスが制限されています。(${errorMsg.trim()})`);
    }

    // セラピスト一覧ページ (/admin/cast/) へ移動して全セラピストのIDと名前を取得
    await page.goto('https://estama.jp/admin/cast/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

    const portalTherapists = await page.evaluate(() => {
      const list: { id: string; name: string }[] = [];
      const seen = new Set<string>();

      document.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href') || '';
        const match = href.match(/\/cast_edit\/(\d+)\/?/) || href.match(/\/cast\/(\d+)\/?/);
        const name = a.textContent?.trim() || '';
        if (match && match[1] && name && name !== '編集' && name !== '編 執' && !seen.has(match[1])) {
          seen.add(match[1]);
          list.push({ id: match[1], name });
        }
      });

      return list;
    });

    const portalNameMap: { [key: string]: string } = {};
    (portalTherapists as { id: string; name: string }[]).forEach((pt) => {
      const norm = pt.name.replace(/\s+/g, '').toLowerCase();
      portalNameMap[norm] = pt.id;
    });

    for (const s of (shifts as any[])) {
      if (s.therapists) {
        if (!s.therapists.estama_therapist_id && s.therapists.name) {
          const norm = (s.therapists.name as string).replace(/\s+/g, '').toLowerCase();
          if (portalNameMap[norm]) {
            s.therapists.estama_therapist_id = portalNameMap[norm];
            await supabaseAdmin
              .from('therapists')
              .update({ estama_therapist_id: portalNameMap[norm] })
              .eq('id', s.therapists.id);
          }
        }
      }
    }

    // 対象となるセラピストID（エステ魂側ID）のリストを作成
    const targetTherapists = activeTherapists && activeTherapists.length > 0
      ? activeTherapists.map(t => t.estama_therapist_id).filter(id => !!id)
      : [...new Set(shifts.map(s => s.therapists?.estama_therapist_id).filter(id => !!id))] as string[];

    console.log(`[EstamaSync] Syncing ${targetTherapists.length} therapists for Estama...`);

    const chunkArray = (arr: any[], size: number) => {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    const chunks = chunkArray(targetTherapists, 3);

    for (const chunk of chunks) {
      await Promise.all(chunk.map(async (estamaId) => {
        const tPage = await context.newPage();
        try {
          await tPage.route('**/*', (route: any) => {
            const type = route.request().resourceType();
            if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
              return route.abort();
            }
            return route.continue();
          });

          console.log(`[EstamaSync] Processing therapist ${estamaId}`);
          
          const therapistShifts = shifts.filter(s => s.therapists?.estama_therapist_id === estamaId);
          const internalTherapistId = therapistShifts[0]?.therapists?.id || activeTherapists?.find(t => t.estama_therapist_id === estamaId)?.id;
          const therapistReservations = reservations ? reservations.filter(r => r.therapist_id === internalTherapistId) : [];

          const scheduleUrl = `https://estama.jp/admin/schedule/${estamaId}/`;
          await tPage.goto(scheduleUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

      // startDate と endDate から同期対象の全ての日付の mmdd を生成する
      const targetDatesMmdd: string[] = [];
      const curr = new Date(startDate);
      const end = new Date(endDate);
      while (curr <= end) {
        const mm = String(curr.getMonth() + 1).padStart(2, '0');
        const dd = String(curr.getDate()).padStart(2, '0');
        targetDatesMmdd.push(`${mm}/${dd}`);
        curr.setDate(curr.getDate() + 1);
      }

      // JSで動的にテーブルを解析して入力する
      await tPage.evaluate(({ shifts, reservations, targetDatesMmdd }: { shifts: any[], reservations: any[], targetDatesMmdd: string[] }) => {
        const timeToMins = (t: string, baseStart?: string) => {
          if (!t) return 0;
          const [h, m] = t.split(':').map(Number);
          let mins = h * 60 + m;
          // 基準開始時間(baseStart)がある場合、それより大幅に小さい時間（例えば04:00と13:00）は翌日とみなす
          if (baseStart) {
            const [sh] = baseStart.split(':').map(Number);
            if (mins < sh * 60 - 60) mins += 24 * 60;
          }
          return mins;
        };



        const parseJST = (dStr: any) => {
          if (!dStr) return { mmdd: '', yyyymmdd: '' };
          const s = String(dStr);
          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            const [y, m, d] = s.split('-');
            return { mmdd: `${m}/${d}`, yyyymmdd: `${y}-${m}-${d}` };
          }
          const dt = new Date(s);
          const jstMs = dt.getTime() + (dt.getTimezoneOffset() + 540) * 60000;
          const jstDate = new Date(jstMs);
          const mm = String(jstDate.getMonth() + 1).padStart(2, '0');
          const dd = String(jstDate.getDate()).padStart(2, '0');
          const yyyy = String(jstDate.getFullYear());
          return { mmdd: `${mm}/${dd}`, yyyymmdd: `${yyyy}-${mm}-${dd}` };
        };

        const dateMap: { [key: string]: any } = {};
        
        // 最初に全対象日付を shift: null で初期化
        targetDatesMmdd.forEach(mmdd => {
          dateMap[mmdd] = { shift: null, res: [] };
        });

        shifts.forEach((s: any) => {
          const sJst = parseJST(s.date);
          if (sJst.mmdd && dateMap[sJst.mmdd]) {
            dateMap[sJst.mmdd] = {
              shift: s,
              res: reservations.filter((r: any) => {
                if (!r.date) return false;
                const rJst = parseJST(r.date);
                return rJst.yyyymmdd === sJst.yyyymmdd;
              })
            };
          }
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
              if (colData) {
                const select = cell.querySelector('select');
                if (select) {
                  let targetStatus = '';

                  if (colData.shift) {
                    const sStart = timeToMins(colData.shift.start_time, colData.shift.start_time);
                    const sEnd = timeToMins(colData.shift.end_time, colData.shift.start_time);
                    
                    if (rowMins >= sStart && rowMins < sEnd) {
                      // 出勤時間内：予約チェック
                      const isReserved = colData.res.some((r: any) => {
                        const rStart = timeToMins(r.start_time, colData.shift.start_time);
                        const rEnd = timeToMins(r.end_time, colData.shift.start_time);
                        // 30分枠と予約枠の重複判定
                        return rowMins < rEnd && (rowMins + 30) > rStart;
                      });
                      targetStatus = isReserved ? '×' : '○';
                    } else {
                      // 出勤時間外
                      targetStatus = '─';
                    }
                  } else {
                    // シフトがない日
                    targetStatus = '─';
                  }
                  
                  if (targetStatus === '─') {
                    for (const opt of Array.from(select.options)) {
                      if (opt.value === '0' || opt.text.includes('─') || opt.text.includes('お休み') || opt.text.includes('未設定')) {
                        if (select.value !== opt.value) {
                          select.value = opt.value;
                          
                        }
                        break;
                      }
                    }
                  } else {
                    for (const opt of Array.from(select.options)) {
                      // 記号揺れや表記揺れを考慮。エステ魂の実際のオプション値（1: ○, 2: ×）も考慮
                      const t = opt.text;
                      const val = opt.value;
                      if (
                        t.includes(targetStatus) || 
                        (targetStatus === '×' && (val === '2' || t.includes('x') || t.includes('✕') || t.includes('空きなし'))) ||
                        (targetStatus === '○' && (val === '1' || t.includes('受付中') || t === '〇'))
                      ) {
                        if (select.value !== opt.value) {
                          select.value = opt.value;
                          
                        }
                        break;
                      }
                    }
                  }
                }
              }
            });
          } else {
            // 時間枠以外の行（出退勤時刻など）
            Array.from(tr.cells).forEach(cell => {
              const colData = cols[cell.cellIndex];
              if (colData) {
                const selects = cell.querySelectorAll('select');
                // 最低2つあれば出勤・退勤とみなす
                if (selects.length >= 2) {
                  if (colData.shift) {
                    const sStart = colData.shift.start_time.substring(0, 5); // "13:00"
                    const sEnd = colData.shift.end_time.substring(0, 5);
                    
                    [ {sel: selects[0], val: sStart}, {sel: selects[1], val: sEnd} ].forEach(({sel, val}) => {
                      for (const opt of Array.from(sel.options)) {
                        if (opt.text.includes(val) || opt.value.includes(val)) {
                          if (sel.value !== opt.value) {
                            sel.value = opt.value;
                            
                          }
                          break;
                        }
                      }
                    });
                  } else {
                    // シフトが無い日は出退勤を未設定（空白）にする
                    [ selects[0], selects[1] ].forEach(sel => {
                      for (const opt of Array.from(sel.options)) {
                        if (opt.value === '' || opt.text.includes('出勤') || opt.text.includes('退勤') || opt.text.includes('未設定')) {
                          if (sel.value !== opt.value) {
                            sel.value = opt.value;
                            
                          }
                          break;
                        }
                      }
                    });
                  }
                }
              }
            });
          }
        });
      }, { shifts: therapistShifts, reservations: therapistReservations, targetDatesMmdd });

      // 保存ボタンの実行（IDで確実に指定）
      const saveBtn = await tPage.$('#SendWorkSchedule, button:has-text("出勤情報を保存する"), input[value*="保存"], a:has-text("保存")');
      if (saveBtn) {
        await Promise.all([
          tPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {}),
          saveBtn.click()
        ]);
        // 非同期保存（AJAX）の可能性も考慮して少し待機
        await tPage.waitForTimeout(2000);
      } else {
        console.warn(`[EstamaSync] 保存ボタンが見つかりませんでした (therapist: ${estamaId})`);
      }
        } catch (e: any) {
          console.error(`[EstamaSync] Error on therapist ${estamaId}:`, e);
        } finally {
          await tPage.close();
        }
      }));
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

      const submitButton = await page.$('button[type="submit"], input[type="submit"], form button, .login-btn, a[type="submit"], a.send-post');
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

    // ログイン成功チェック（URLがログインページのままなら失敗）
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      // ログインエラーメッセージの取得を試みる
      const loginError = await page.$('.alert-danger, .error-message, .error, .validation-error');
      let errorMsg = '不明なエラー';
      if (loginError) {
        errorMsg = await loginError.textContent() || errorMsg;
      }
      throw new Error(`エステ魂ログインに失敗しました。認証情報が間違っているか、アクセスが制限されています。(${errorMsg.trim()})`);
    }

    // 本日のスケジュール / セラピスト一覧ページへ
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const scheduleUrl = `https://estama.jp/admin/schedule/${dateStr}/`;
    await page.goto(scheduleUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});

    // ページ全体のリンクやセレクトボックスからセラピスト情報（IDと名前）を柔軟に抽出
    const therapists = await page.evaluate(() => {
      const list: { id: string; name: string }[] = [];
      const seen = new Set<string>();

      // 1. /schedule/ID/ 形式のリンクから抽出
      const links = document.querySelectorAll('a[href*="/schedule/"]');
      links.forEach(a => {
        const href = a.getAttribute('href') || '';
        const match = href.match(/\/schedule\/(\d+)\/?/);
        const name = a.textContent?.trim() || '';
        if (match && match[1] && name && !seen.has(match[1])) {
          seen.add(match[1]);
          list.push({ id: match[1], name });
        }
      });

      // 2. セレクトボックスのoptionから抽出
      const options = document.querySelectorAll('select option');
      options.forEach(opt => {
        const val = (opt as HTMLOptionElement).value;
        const name = opt.textContent?.trim() || '';
        if (val && /^\d+$/.test(val) && name && !seen.has(val)) {
          seen.add(val);
          list.push({ id: val, name });
        }
      });

      // 3. テーブル行から抽出
      const rows = document.querySelectorAll('tr');
      rows.forEach(tr => {
        const id = tr.getAttribute('data-girl-id') || (tr as any).querySelector?.('input[name*="id"]')?.value || '';
        const nameEl = tr.querySelector('td:nth-child(2), .name');
        const name = nameEl?.textContent?.trim() || '';
        if (id && name && !seen.has(id)) {
          seen.add(id);
          list.push({ id, name });
        }
      });

      return list;
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
