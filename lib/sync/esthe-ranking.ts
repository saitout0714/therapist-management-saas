import { chromium } from 'playwright';

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
 * @param date 同期対象日 (YYYY-MM-DD)
 * @param shifts 同期するシフトデータ
 */
export async function syncShiftsToEstheRanking(
  shopUrl: string,
  loginId: string,
  password: string,
  date: string,
  shifts: any[]
): Promise<SyncResult> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`[EstheRankingSync] Starting sync for date ${date}`);
    
    // 1. ログイン画面へのアクセス
    await page.goto(shopUrl);
    
    // 2. ログイン処理
    await page.fill('input[name="loginname"]', loginId);
    await page.fill('input[name="password"]', password);
    await page.click('form[action="/login/"] button[type="submit"]');
    
    await page.waitForLoadState('networkidle');

    // ログイン成功確認（エラーメッセージ等のチェック）
    const loginError = await page.$('.alert-danger, .error-message');
    if (loginError) {
      const errorText = await loginError.textContent();
      throw new Error(`ログインに失敗しました: ${errorText?.trim()}`);
    }

    // 3. 出勤情報更新ページへの遷移
    // dateフォーマットが YYYY-MM-DD なので、そのままURLに利用できるか確認
    // 通常は https://www.esthe-ranking.jp/shop/schedule/2026-07-15/ のような形式
    const targetUrl = `https://www.esthe-ranking.jp/shop/schedule/${date}/`;
    await page.goto(targetUrl);
    await page.waitForLoadState('networkidle');

    const scheduleForm = await page.$(`form[action="/shop/schedule/${date}/"]`);
    if (!scheduleForm) {
      throw new Error(`対象日(${date})のスケジュールフォームが見つかりませんでした。`);
    }

    // シフト設定の反映
    console.log(`[EstheRankingSync] Syncing ${shifts.length} shifts...`);
    
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

    for (const rankingId of therapistIdsOnPage) {
      const shift = shifts.find(s => s.therapists?.esthe_ranking_therapist_id === rankingId);

      if (shift) {
        // 出勤として設定
        const startTime = formatTime(shift.start_time);
        const endTime = formatTime(shift.end_time);
        
        await page.selectOption(`select[name="${rankingId}[start_work]"]`, startTime).catch(() => {});
        await page.selectOption(`select[name="${rankingId}[end_work]"]`, endTime).catch(() => {});
        
        // delete_flagのチェックボックスがあれば外す
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
          // 削除チェックボックスが無い場合は「0」（未設定）を選択
          await page.selectOption(`select[name="${rankingId}[start_work]"]`, '0').catch(() => {});
          await page.selectOption(`select[name="${rankingId}[end_work]"]`, '0').catch(() => {});
        }
      }
    }

    // 保存ボタンをクリック
    await page.click('form button.btn-success[type="submit"]');
    await page.waitForLoadState('networkidle');

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
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`[EstheRankingSync] Fetching therapists...`);
    
    await page.goto(shopUrl);
    await page.fill('input[name="loginname"]', loginId);
    await page.fill('input[name="password"]', password);
    await page.click('form[action="/login/"] button[type="submit"]');
    
    await page.waitForLoadState('networkidle');

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
    await page.goto(targetUrl);
    await page.waitForLoadState('networkidle');

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

