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
    console.log('[EsloveSync] Dynamically importing playwright-core and @sparticuz/chromium...');
    const { chromium: playwrightCore } = await import('playwright-core');
    const chromium = (await import('@sparticuz/chromium')).default;

    chromium.setGraphicsMode = false;

    console.log('[EsloveSync] Launching playwrightCore...');
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
  details?: any[];
}

const ESLOVE_LOGIN_URL = 'https://eslove.jp/admin/login';

/**
 * エステラブの管理画面にログインする。全ての呼び出し口はこの関数を使うこと。
 */
export async function loginToEslove(page: any, shopUrl: string, loginId: string, password: string): Promise<void> {
  page.on('dialog', (d: any) => d.accept().catch(() => {}));

  const targetUrl = shopUrl || ESLOVE_LOGIN_URL;
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(async () => {
    await page.goto(ESLOVE_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  });

  const idInput = await page.$('input[type="text"], input[name="id"], input[name="login_id"]');
  const passInput = await page.$('input[type="password"]');

  if (!idInput || !passInput) {
    throw new Error('エステラブのログイン入力項目が見つかりませんでした。');
  }

  await idInput.fill(loginId);
  await passInput.fill(password);

  const submitButton = await page.$('button[type="submit"], input[type="submit"]');
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

  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    throw new Error('エステラブログインに失敗しました。認証情報が間違っているか、アクセスが制限されています。');
  }
}

/**
 * 出勤時刻の select 要素の value 形式（コロン無しの数字文字列、深夜帯は24時以降に繰り上げ）に変換する。
 * 例: "06:00" -> "600", "17:30" -> "1730", "01:30" -> "2530"（翌1:30扱い）
 */
function toEsloveTimeValue(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  const match = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  let h = parseInt(match[1], 10);
  const min = match[2];
  if (h < 6) h += 24;
  return `${h}${min}`;
}

/**
 * 対象日付（YYYY-MM-DD, JST基準の暦日）が「今日」から何日後かを計算する。
 * エステラブの出勤情報ページは day=0（今日）を基準にした相対オフセットで日付を指定する。
 */
function dateOffsetFromToday(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);

  const now = new Date();
  const jstMs = now.getTime() + (now.getTimezoneOffset() + 540) * 60000;
  const jstNow = new Date(jstMs);
  const todayUTC = Date.UTC(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());

  return Math.round((target - todayUTC) / 86400000);
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function newBlockingPage(context: any) {
  const page = await context.newPage();
  await page.route('**/*', (route: any) => {
    const type = route.request().resourceType();
    if (['image', 'font', 'media', 'websocket'].includes(type)) return route.abort();
    return route.continue();
  });
  return page;
}

/**
 * エステラブからセラピスト一覧（管理画面上のID・名前）を取得する。
 */
export async function fetchTherapistsFromEslove(
  shopUrl: string,
  loginId: string,
  password: string
): Promise<{ id: string; name: string }[]> {
  let browser: any;
  let page: any;
  try {
    console.log('[EsloveSync] Fetching therapists from Eslove...');
    browser = await getBrowser();
    const context = await browser.newContext({ userAgent: USER_AGENT, viewport: { width: 1280, height: 900 } });
    page = await newBlockingPage(context);

    await loginToEslove(page, shopUrl, loginId, password);

    await page.goto('https://eslove.jp/admin/shop/therapist', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(500);

    const therapists = await page.evaluate(() => {
      const list: { id: string; name: string }[] = [];
      const seen = new Set<string>();

      document.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href') || '';
        const match = href.match(/\/admin\/shop\/therapist\/edit\/(\d+)/);
        const name = a.textContent?.trim() || '';
        if (match && match[1] && name && name !== 'edit' && name !== 'delete' && !seen.has(match[1])) {
          seen.add(match[1]);
          list.push({ id: match[1], name });
        }
      });

      return list;
    });

    console.log(`[EsloveSync] Found ${therapists.length} therapists on Eslove portal.`);

    if (therapists.length === 0) {
      const pageTitle = await page.title().catch(() => 'unknown');
      const pageUrl = page.url();
      throw new Error(`エステラブのセラピスト一覧を取得できませんでした（0件）。ログインまたはページ構造の読み取りに失敗している可能性があります。(画面タイトル: ${pageTitle}, URL: ${pageUrl})`);
    }

    return therapists;
  } catch (error: any) {
    const pageTitle = page ? await page.title().catch(() => 'unknown') : 'unknown';
    const pageUrl = page ? page.url() : 'unknown';
    console.error('[EsloveSync] Error fetching therapists:', error, 'Page Title:', pageTitle, 'URL:', pageUrl);
    throw new Error(`${error.message} (画面タイトル: ${pageTitle}, URL: ${pageUrl})`);
  } finally {
    if (browser) await browser.close();
  }
}

function normalizeTherapistName(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase();
}

/**
 * ポータル側に既にプロフィールが存在するキャストを名前で探す。
 * 新規登録前にこれを挟むことで、同名の重複プロフィール作成を防ぐ。
 */
export async function findExistingEsloveIdByName(
  shopUrl: string,
  loginId: string,
  password: string,
  therapistName: string
): Promise<string | null> {
  try {
    const portalTherapists = await fetchTherapistsFromEslove(shopUrl, loginId, password);
    const normalized = normalizeTherapistName(therapistName);
    const match = portalTherapists.find(t => normalizeTherapistName(t.name) === normalized);
    return match ? match.id : null;
  } catch (e) {
    console.error('[EsloveSync] findExistingEsloveIdByName failed:', e);
    return null;
  }
}

/**
 * 出勤情報をエステラブへ同期する。
 * エステラブの出勤情報ページ（/admin/shop/therapist_schedule/daily）は1日単位のページで、
 * day=N（今日からの相対日数）で対象日を切り替える。ページ内には
 * TherapistSchedules[行番号][therapist_id] の隠しフィールドと
 * TherapistSchedules[行番号][start_time]/[end_time] の select が行ごとに存在し、
 * 行ごとに「保存する」ボタン（.js-regist）で個別に保存する。
 */
export async function syncShiftsToEslove(
  shopUrl: string,
  loginId: string,
  password: string,
  startDate: string,
  endDate: string,
  shifts: any[],
  activeTherapists: any[] = []
): Promise<SyncResult> {
  let browser: any;
  let page: any;

  try {
    console.log(`[EsloveSync] Starting shift sync from ${startDate} to ${endDate}`);
    browser = await getBrowser();
    const context = await browser.newContext({ userAgent: USER_AGENT, viewport: { width: 1280, height: 900 } });
    page = await newBlockingPage(context);

    await loginToEslove(page, shopUrl, loginId, password);

    const dates: string[] = [];
    const cur = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      cur.setDate(cur.getDate() + 1);
    }

    const details: any[] = [];

    for (const dateStr of dates) {
      const offset = dateOffsetFromToday(dateStr);
      const url = `https://eslove.jp/admin/shop/therapist_schedule/daily?day=${offset}`;

      let navigated = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
          navigated = true;
          break;
        } catch (err) {
          if (attempt === 1) await page.waitForTimeout(1000);
          else throw err;
        }
      }
      if (!navigated) {
        details.push({ date: dateStr, error: '出勤情報ページを開けませんでした' });
        continue;
      }
      // Vue側のハイドレーション待ち
      await page.waitForTimeout(800);

      const rowMap: Record<string, number> = await page.evaluate(() => {
        const map: Record<string, number> = {};
        document.querySelectorAll('input[name^="TherapistSchedules"][name$="[therapist_id]"]').forEach((el: any) => {
          const m = (el.getAttribute('name') || '').match(/TherapistSchedules\[(\d+)\]/);
          if (m && el.value) map[el.value] = parseInt(m[1], 10);
        });
        return map;
      });

      const dayShifts = shifts.filter((s: any) => String(s.date).slice(0, 10) === dateStr);

      const targetTherapistIds: string[] = activeTherapists.length > 0
        ? activeTherapists.map((t: any) => t.eslove_therapist_id).filter((id: any) => !!id)
        : [...new Set(dayShifts.map((s: any) => s.therapists?.eslove_therapist_id).filter((id: any) => !!id))] as string[];

      for (const esloveId of targetTherapistIds) {
        const rowIdx = rowMap[esloveId];
        if (rowIdx === undefined) {
          details.push({ esloveId, date: dateStr, error: '出勤情報ページにセラピスト行が見つかりません' });
          continue;
        }

        const shift = dayShifts.find((s: any) => s.therapists?.eslove_therapist_id === esloveId);
        const startVal = shift ? toEsloveTimeValue(shift.start_time) : '';
        const endVal = shift ? toEsloveTimeValue(shift.end_time) : '';

        try {
          const startSelect = page.locator(`select[name="TherapistSchedules[${rowIdx}][start_time]"]`);
          const endSelect = page.locator(`select[name="TherapistSchedules[${rowIdx}][end_time]"]`);

          if (await startSelect.count() > 0) await startSelect.selectOption(startVal).catch(() => {});
          if (await endSelect.count() > 0) await endSelect.selectOption(endVal).catch(() => {});

          const saveBtn = page.locator('.js-regist').nth(rowIdx);
          if (await saveBtn.count() > 0) {
            await saveBtn.click({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(500);
          }

          details.push({ esloveId, date: dateStr, start: startVal, end: endVal, saved: true });
        } catch (e: any) {
          details.push({ esloveId, date: dateStr, error: e.message });
        }
      }
    }

    return { success: true, message: 'エステラブへの出勤情報の同期が完了しました。', details };
  } catch (error: any) {
    const pageTitle = page ? await page.title().catch(() => 'unknown') : 'unknown';
    const pageUrl = page ? page.url() : 'unknown';
    console.error('[EsloveSync] Error:', error, 'Page Title:', pageTitle, 'URL:', pageUrl);
    return { success: false, error: `${error.message} (画面タイトル: ${pageTitle}, URL: ${pageUrl})` };
  } finally {
    if (browser) {
      try { await Promise.all(browser.contexts().map((c: any) => c.close())); } catch (e) {}
      await browser.close();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}
