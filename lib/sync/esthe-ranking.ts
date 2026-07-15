import { chromium as playwrightLocal } from 'playwright';
import { chromium as playwrightCore } from 'playwright-core';
import chromium from '@sparticuz/chromium';

async function getBrowser() {
  const isLocal = !!process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.NODE_ENV === 'development' || !process.env.VERCEL;

  if (isLocal) {
    return await playwrightLocal.launch({ headless: true });
  } else {
    // Vercel Serverless Function 等での実行用
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
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`[EstheRankingSync] Starting sync from ${startDate} to ${endDate}`);
    
    // 1. ログイン画面へのアクセス
    await page.goto(shopUrl);
    
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

    // 期間内の日付を配列で生成
    const datesToSync: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    // 無限ループ防止のため最大31日に制限
    let safetyCounter = 0;
    while (current <= end && safetyCounter < 31) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      datesToSync.push(`${yyyy}-${mm}-${dd}`);
      current.setDate(current.getDate() + 1);
      safetyCounter++;
    }

    console.log(`[EstheRankingSync] Syncing ${datesToSync.length} days...`);

    for (const currentDate of datesToSync) {
      console.log(`[EstheRankingSync] Processing ${currentDate}`);
      
      const targetUrl = `https://www.esthe-ranking.jp/shop/schedule/${currentDate}/`;
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
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
    }


    console.log(`[EstheRankingSync] Sync completed successfully.`);
    return { success: true, message: 'メンズエステランキングへの出勤情報同期が完了しました。' };
  } catch (error: any) {
    console.error('[EstheRankingSync] Error:', error);
    return { success: false, error: error.message };
  } finally {
    await browser.close();
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
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`[EstheRankingSync] Fetching therapists...`);
    
    await page.goto(shopUrl);
    await page.fill('input[name="loginname"]', loginId);
    await page.fill('input[name="password"]', password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      page.click('form[action="/login/"] button[type="submit"]')
    ]);

    const loginError = await page.$('.alert-danger, .error-message');
    if (loginError) {
      const errorText = await loginError.textContent();
      throw new Error(`ログインに失敗しました: ${errorText?.trim()}`);
    }

    // 本日の日付のスケジュールページへ遷移 (確実にリストを取得するため)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    const targetUrl = `https://www.esthe-ranking.jp/shop/schedule/${dateStr}/`;
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    // スケジュールページの読み込みを少し待つ
    await page.waitForSelector('tr.tr-admin-linkcheck', { timeout: 10000 }).catch(() => {});

    // テーブル行からIDと名前を抽出
    const therapists = await page.$$eval('tr.tr-admin-linkcheck', (rows) => {
      return rows.map((tr) => {
        const id = tr.getAttribute('data-girl-id') || '';
        // 2番目のtdの中にあるspanを探す
        const nameSpan = tr.querySelector('td:nth-child(2) span');
        const name = nameSpan ? nameSpan.textContent?.trim() || '' : '';
        return { id, name };
      }).filter(t => t.id && t.name);
    });

    console.log(`[EstheRankingSync] Found ${therapists.length} therapists on portal.`);
    return therapists;
  } catch (error: any) {
    console.error('[EstheRankingSync] Error fetching therapists:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

