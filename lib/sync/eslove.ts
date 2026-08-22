import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getBrowser } from './browser';
import { describeRelayState } from './ssh-relay';

async function uploadDebugScreenshot(page: any, name: string): Promise<string | null> {
  try {
    const buffer = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: true });
    const path = `debug/${name}_${Date.now()}.jpg`;
    await supabaseAdmin.storage.from('therapist-photos').upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
    const { data } = supabaseAdmin.storage.from('therapist-photos').getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) {
    console.error('[EsloveSync] Screenshot failed:', e);
    return null;
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

  // エステラブは本番サーバーのIPに対して断続的に403を返す（メンズエステランキングと同様のWAFと推測される）。
  // 一度で諦めず、間隔を空けて開き直すことで大半は救済できる。
  const maxAttempts = 3;
  let idInput: any = null;
  let passInput: any = null;
  let lastIssue = '不明';
  let lastResponse: any = null;
  let lastNavError = '';

  // 遷移そのものが失敗した理由（中継プロキシに繋がらない・タイムアウト等）は、
  // 403で弾かれた場合と原因がまったく別なので握り潰さずに残す。
  const tryGoto = async (url: string) => {
    try {
      lastNavError = '';
      return await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch (e: any) {
      lastNavError = e?.message ? String(e.message).split('\n')[0] : String(e);
      return null;
    }
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // トップページ (https://eslove.jp/) にアクセスしてセッションとWAF通過クッキーを確立
    await page.goto('https://eslove.jp/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(attempt === 1 ? 1000 : 2000 * attempt);

    lastResponse = await tryGoto(targetUrl);
    if (!lastResponse || (typeof lastResponse.status === 'function' && lastResponse.status() === 403)) {
      lastResponse = await tryGoto(ESLOVE_LOGIN_URL);
    }

    idInput = await page.waitForSelector('input[type="text"], input[name="login_id"]', { timeout: 8000 }).catch(() => null);
    passInput = await page.waitForSelector('input[type="password"]', { timeout: 8000 }).catch(() => null);

    if (idInput && passInput) {
      if (attempt > 1) console.log(`[EsloveSync] ログインページを${attempt}回目で開けました。`);
      break;
    }

    const status = typeof lastResponse?.status === 'function' ? lastResponse.status() : '不明';
    const title = await page.title().catch(() => 'unknown');
    lastIssue = `HTTP ${status} / 画面タイトル: ${title}` + (lastNavError ? ` / 遷移エラー: ${lastNavError}` : '');

    if (attempt < maxAttempts) {
      const waitMs = 3000 * attempt;
      console.warn(`[EsloveSync] ログインページを開けず再試行します (${attempt}/${maxAttempts}): ${lastIssue}`);
      await page.waitForTimeout(waitMs);
    }
  }

  if (!idInput || !passInput) {
    const url = page.url();
    const screenshotUrl = await uploadDebugScreenshot(page, 'eslove_login_form_not_found');
    throw new Error(`エステラブのログインページを開けませんでした（${maxAttempts}回試行）。サイト側のアクセス制限(403)の可能性があります。最終状態: ${lastIssue} [${describeRelayState()}] (URL: ${url}, スクリーンショット: ${screenshotUrl || 'なし'})`);
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
    const title = await page.title().catch(() => 'unknown');
    const screenshotUrl = await uploadDebugScreenshot(page, 'eslove_login_failed');
    throw new Error(`エステラブログインに失敗しました。認証情報が間違っているか、アクセスが制限されています。[${describeRelayState()}] (画面タイトル: ${title}, URL: ${currentUrl}, スクリーンショット: ${screenshotUrl || 'なし'})`);
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
 * エステラブの出勤情報ページは day=0（今日）を基準にした相対オフセットで日付を指定するため、
 * この値は「最初の推測値」として使う。
 *
 * ※エステラブ側の「今日」は暦日ではなく営業日基準で切り替わるらしく、深夜帯に実行すると
 *   前日扱いになって1日ずれる。そのため必ず resolveDayOffset() で実際の日付を確認すること。
 */
function guessDayOffset(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);

  const now = new Date();
  const jstMs = now.getTime() + (now.getTimezoneOffset() + 540) * 60000;
  const jstNow = new Date(jstMs);
  const todayUTC = Date.UTC(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());

  return Math.round((target - todayUTC) / 86400000);
}

/** "2026-08-21" → "20260821"（ページ内の day 隠しフィールドと同じ形式） */
function toCompactDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/** "20260821" と "20260820" の日数差を返す */
function diffDays(fromCompact: string, toCompact: string): number {
  const parse = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  return Math.round((parse(toCompact) - parse(fromCompact)) / 86400000);
}

const SCHEDULE_BASE_URL = 'https://eslove.jp/admin/shop/therapist_schedule/daily';

function scheduleUrl(offset: number, pageNum = 1): string {
  return `${SCHEDULE_BASE_URL}?day=${offset}` + (pageNum > 1 ? `&page=${pageNum}` : '');
}

/**
 * 出勤情報の表が描画されるまで待つ。
 * ※この表の各フィールドは type="hidden" なので、既定の「表示されるまで待つ」では
 *   永久に条件を満たさずタイムアウトしてしまう。必ず state:'attached' を使うこと。
 */
async function waitForScheduleTable(page: any): Promise<void> {
  await page
    .waitForSelector('input[name^="TherapistSchedules"][name$="[day]"]', { state: 'attached', timeout: 20000 })
    .catch(() => {});
}

/** 開いている出勤情報ページが実際に何日のものかを、隠しフィールドから読み取る */
async function readShownDate(page: any): Promise<string | null> {
  await waitForScheduleTable(page);
  return await page.evaluate(() => {
    const el = document.querySelector('input[name^="TherapistSchedules"][name$="[day]"]') as HTMLInputElement | null;
    return el?.value || null;
  });
}

/** 現在ページ上の「エステラブのセラピストID → 行番号」対応を読み取る */
async function readRowMap(page: any): Promise<Record<string, number>> {
  return await page.evaluate(() => {
    const map: Record<string, number> = {};
    document.querySelectorAll('input[name^="TherapistSchedules"][name$="[therapist_id]"]').forEach((el: any) => {
      const m = (el.getAttribute('name') || '').match(/TherapistSchedules\[(\d+)\]/);
      if (m && el.value) map[el.value] = parseInt(m[1], 10);
    });
    return map;
  });
}

/** 指定行に現在設定されている出退勤時刻を読み取る */
async function readRowTimes(page: any, rowIdx: number): Promise<{ start: string; end: string }> {
  return await page.evaluate((i: number) => {
    const s = document.querySelector(`select[name="TherapistSchedules[${i}][start_time]"]`) as HTMLSelectElement | null;
    const e = document.querySelector(`select[name="TherapistSchedules[${i}][end_time]"]`) as HTMLSelectElement | null;
    return { start: s?.value || '', end: e?.value || '' };
  }, rowIdx);
}

/**
 * 目的の日付のページを開き、そのとき使えた day オフセットを返す。
 *
 * エステラブの day は「今日」からの相対指定だが、その「今日」がいつ切り替わるかは
 * 営業日設定に依存し、こちらの暦計算とずれることがある（深夜実行だと1日前になる）。
 * 実際にページに書かれている日付を読んで、ずれていれば補正して開き直す。
 */
async function resolveDayOffset(page: any, dateStr: string): Promise<number | null> {
  const wanted = toCompactDate(dateStr);
  let offset = guessDayOffset(dateStr);

  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(scheduleUrl(offset), { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
    const shown = await readShownDate(page);
    if (!shown) return null;
    if (shown === wanted) return offset;

    const correction = diffDays(shown, wanted);
    if (correction === 0) return null;
    console.log(`[EsloveSync] ${dateStr}: day=${offset} は ${shown} だったため ${correction} 日ぶん補正します`);
    offset += correction;
  }
  return null;
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
    browser = await getBrowser({ useRelay: true });
    const context = await browser.newContext({ userAgent: USER_AGENT, viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    page = await newBlockingPage(context);

    await loginToEslove(page, shopUrl, loginId, password);

    await page.goto('https://eslove.jp/admin/shop/therapist', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForSelector('a[href*="/therapist/edit/"]', { timeout: 15000 }).catch(() => {});

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
    browser = await getBrowser({ useRelay: true });
    const context = await browser.newContext({ userAgent: USER_AGENT, viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
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
      // 実際にその日付が表示されるオフセットを特定する（暦計算だけに頼らない）
      const offset = await resolveDayOffset(page, dateStr);
      if (offset === null) {
        details.push({ date: dateStr, error: '出勤情報ページで対象日を開けませんでした' });
        continue;
      }

      const dayShifts = shifts.filter((s: any) => String(s.date).slice(0, 10) === dateStr);

      const targetTherapistIds: string[] = activeTherapists.length > 0
        ? activeTherapists.map((t: any) => t.eslove_therapist_id).filter((id: any) => !!id)
        : [...new Set(dayShifts.map((s: any) => s.therapists?.eslove_therapist_id).filter((id: any) => !!id))] as string[];

      // 出勤情報ページはセラピスト50人ごとにページ分割される。
      // 51人目以降を取りこぼさないよう、未処理のセラピストが残っている限り次ページを辿る。
      const remaining = new Set(targetTherapistIds);
      const MAX_PAGES = 20;

      for (let pageNum = 1; pageNum <= MAX_PAGES && remaining.size > 0; pageNum++) {
        const url = scheduleUrl(offset, pageNum);

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
          details.push({ date: dateStr, page: pageNum, error: '出勤情報ページを開けませんでした' });
          break;
        }
        await waitForScheduleTable(page);

        // 書き込む直前に、開いているページが本当に対象日かを毎回確認する。
        // 違う日に書き込むと、他の日の出勤情報を壊してしまうため。
        const shownDate = await readShownDate(page);
        if (shownDate !== toCompactDate(dateStr)) {
          details.push({ date: dateStr, page: pageNum, error: `日付が一致しないため書き込みを中止しました（ページの日付: ${shownDate || '不明'}）` });
          break;
        }

        let rowMap = await readRowMap(page);

        // このページに行が1つも無ければ、これ以上ページは存在しない
        if (Object.keys(rowMap).length === 0) break;

        for (const esloveId of [...remaining]) {
          if (rowMap[esloveId] === undefined) continue; // 別のページにいる可能性があるので残しておく
          const rowIdx = rowMap[esloveId];
          remaining.delete(esloveId);

          const shift = dayShifts.find((s: any) => s.therapists?.eslove_therapist_id === esloveId);
          const startVal = shift ? toEsloveTimeValue(shift.start_time) : '';
          const endVal = shift ? toEsloveTimeValue(shift.end_time) : '';

          try {
            // 既に同じ値なら保存しない。大半の行は「休み（空欄）」のまま変わらないため、
            // これだけで書き込み回数が数百回から数回に減り、相手サイトの負荷も抑えられる。
            const before = await readRowTimes(page, rowIdx);
            if (before.start === startVal && before.end === endVal) {
              details.push({ esloveId, date: dateStr, start: startVal, end: endVal, unchanged: true });
              continue;
            }

            await page.selectOption(`select[name="TherapistSchedules[${rowIdx}][start_time]"]`, startVal, { timeout: 10000 });
            await page.selectOption(`select[name="TherapistSchedules[${rowIdx}][end_time]"]`, endVal, { timeout: 10000 });

            // 保存ボタンを押すとページ全体が再読み込みされる。
            // 完了を待たずに次の行へ進むと、読み込み中のページを操作することになり
            // 値がセットされないまま保存だけが走ってしまうため、必ず待つこと。
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
              page.locator('.js-regist').nth(rowIdx).click({ timeout: 10000 }),
            ]);
            await waitForScheduleTable(page);

            // 再読み込み後のページで、本当に保存されたかを読み戻して確認する
            const reloadedDate = await readShownDate(page);
            if (reloadedDate !== toCompactDate(dateStr)) {
              details.push({ esloveId, date: dateStr, error: `保存後に別の日付のページ(${reloadedDate || '不明'})へ遷移したため中止しました` });
              break;
            }

            rowMap = await readRowMap(page);
            const after = await readRowTimes(page, rowMap[esloveId] ?? rowIdx);
            if (after.start === startVal && after.end === endVal) {
              details.push({ esloveId, date: dateStr, start: startVal, end: endVal, saved: true });
            } else {
              details.push({
                esloveId,
                date: dateStr,
                error: `保存が反映されませんでした（期待 ${startVal || '空'}-${endVal || '空'} / 実際 ${after.start || '空'}-${after.end || '空'}）`,
              });
            }
          } catch (e: any) {
            details.push({ esloveId, date: dateStr, error: e.message });
          }
        }
      }

      // 全ページを見ても行が見つからなかったセラピスト
      for (const esloveId of remaining) {
        details.push({ esloveId, date: dateStr, error: '出勤情報ページにセラピスト行が見つかりません' });
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
