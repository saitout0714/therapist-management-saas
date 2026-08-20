import { chromium as playwrightLocal } from 'playwright';
import { openEstheRankingLoginPage } from './esthe-ranking';

async function getBrowser() {
  const isLocal = !!process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.NODE_ENV === 'development' || !process.env.VERCEL;

  if (isLocal) {
    // --single-process/--no-zygote はサーバーレス(Linux)向けの省メモリ設定で、
    // ローカルWindows環境ではクラッシュの原因になるため付与しない
    return await playwrightLocal.launch({
      headless: true,
    });
  } else {
    const { chromium: playwrightCore } = await import('playwright-core');
    const chromium = (await import('@sparticuz/chromium')).default;
    chromium.setGraphicsMode = false;

    return await playwrightCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
}

/** メンズエステランキングの「ニュース種別」セレクトの値 */
export type EstheRankingNewsType = '1' | '2' | '3' | '4' | '9';

export const ESTHE_RANKING_NEWS_TYPES: { value: EstheRankingNewsType; label: string }[] = [
  { value: '1', label: '割引情報' },
  { value: '2', label: 'イベント' },
  { value: '3', label: '出勤速報' },
  { value: '4', label: '新人速報' },
  { value: '9', label: 'お知らせ' },
];

export interface EstheRankingNewsInput {
  newsType: EstheRankingNewsType;
  /** true: すぐに公開 / false: 開始時刻を指定 */
  publishNow: boolean;
  /** publishNow=false のとき使用。店舗管理画面のタイムゾーン(JST)基準 */
  publishDate?: string; // 'YYYY-MM-DD'
  publishHour?: string; // '00'-'23'
  publishMinute?: string; // '00'-'59'
  /** 公開終了時刻を設定するか */
  endEnabled?: boolean;
  endPublishDate?: string; // 'YYYY-MM-DD'
  endPublishHour?: string; // '00'-'23'
  endPublishMinute?: string; // '00'-'59'
  title: string;
  content: string;
  /** アップロード済み画像のローカル一時ファイルパス */
  imagePath?: string | null;
}

export interface NewsPostResult {
  success: boolean;
  message?: string;
  error?: string;
}

function toDotDate(ymd: string): string {
  // 'YYYY-MM-DD' -> 'YYYY/MM/DD'
  return ymd.replace(/-/g, '/');
}

/**
 * 「開始時刻を設定」のセレクトは、その時点からおよそ24時間分の
 * 1時間刻みの選択肢（例: "2026/08/20 13"）しか持たない。
 * 指定日時がその範囲外の場合は、最も近い選択肢に丸める。
 */
async function selectClosestPublishHour(page: any, desiredDate: string, desiredHour: string): Promise<string> {
  const desired = `${toDotDate(desiredDate)} ${desiredHour.padStart(2, '0')}`;

  const options: string[] = await page.$$eval('#published-h option', (opts: any[]) =>
    opts.map((o: any) => o.value)
  );

  if (options.length === 0) {
    throw new Error('公開開始時刻の選択肢を取得できませんでした。');
  }

  if (options.includes(desired)) {
    await page.selectOption('#published-h', desired);
    return desired;
  }

  // 選択肢は時系列順に並んでいる前提で、指定日時に最も近いものを選ぶ
  const toTime = (v: string) => {
    const m = v.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2})$/);
    if (!m) return NaN;
    return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:00:00`).getTime();
  };
  const desiredTime = toTime(desired);
  let closest = options[0];
  let closestDiff = Infinity;
  for (const opt of options) {
    const diff = Math.abs(toTime(opt) - desiredTime);
    if (!Number.isNaN(diff) && diff < closestDiff) {
      closestDiff = diff;
      closest = opt;
    }
  }

  await page.selectOption('#published-h', closest);
  return closest;
}

/**
 * メンズエステランキングにニュース（お知らせ／割引情報等）を投稿する。
 * 1日5回までという投稿上限はポータル側が管理しており、上限超過時のエラーは
 * そのまま呼び出し元へ伝える。
 */
export async function postNewsToEstheRanking(
  shopUrl: string,
  loginId: string,
  password: string,
  news: EstheRankingNewsInput
): Promise<NewsPostResult> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    acceptDownloads: false,
  });
  const page: any = await context.newPage();

  // 送信ボタンは確認ダイアログ(window.confirm)を出すため、常に承諾する
  page.on('dialog', (dialog: any) => dialog.accept().catch(() => {}));

  try {
    await page.route('**/*', (route: any) => {
      const type = route.request().resourceType();
      if (['media', 'font', 'websocket'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // 1. ログイン
    await openEstheRankingLoginPage(page, shopUrl);
    await page.fill('input[name="loginname"]', loginId);
    await page.fill('input[name="password"]', password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      page.click('form[action="/login/"] button[type="submit"]'),
    ]);

    const loginError = await page.$('.alert-danger, .error-message');
    if (loginError) {
      const errorText = await loginError.textContent();
      throw new Error(`ログインに失敗しました: ${errorText?.trim()}`);
    }

    // 2. ニュース投稿ページへ
    await page.goto('https://www.esthe-ranking.jp/shop/news/add/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#type', { timeout: 10000 });

    // 3. ニュース種別
    await page.selectOption('#type', news.newsType);

    // 4. 公開開始時刻
    let appliedPublishHour: string | null = null;
    if (news.publishNow) {
      await page.check('#publish-now-1');
    } else {
      if (!news.publishDate || !news.publishHour) {
        throw new Error('開始時刻を指定する場合は日付と時間が必要です。');
      }
      await page.check('#publish-now-0');
      appliedPublishHour = await selectClosestPublishHour(page, news.publishDate, news.publishHour);
      await page.selectOption('#published-m', (news.publishMinute || '00').padStart(2, '0'));
    }

    // 5. 公開終了時刻
    if (news.endEnabled) {
      if (!news.endPublishDate || !news.endPublishHour) {
        throw new Error('終了時刻を指定する場合は日付と時間が必要です。');
      }
      const isChecked = await page.isChecked('#indefinite1');
      if (!isChecked) await page.check('#indefinite1');
      const endStr = `${toDotDate(news.endPublishDate)} ${news.endPublishHour.padStart(2, '0')}:${(news.endPublishMinute || '00').padStart(2, '0')}`;
      await page.fill('#end-published', endStr);
    }

    // 6. 題名・本文
    await page.fill('#title', news.title);
    await page.fill('#content', news.content);

    // 7. 画像（任意）
    if (news.imagePath) {
      const fileInput = await page.$('#image');
      if (fileInput) await fileInput.setInputFiles(news.imagePath);
    }

    // 8. 送信
    const urlBeforeSubmit = page.url();
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
      page.click('button.button-confirm-submit'),
    ]);
    await page.waitForTimeout(500);

    // 9. 結果判定：URLが変わらず、かつエラー表示が出ている場合は失敗とみなす
    const stillOnAddPage = page.url() === urlBeforeSubmit || page.url().includes('/shop/news/add/');
    if (stillOnAddPage) {
      const errorEl = await page.$('.alert-danger, .error-message, .text-danger, .invalid-feedback');
      if (errorEl) {
        const errorText = (await errorEl.textContent())?.trim();
        if (errorText) {
          throw new Error(errorText);
        }
      }
    }

    return {
      success: true,
      message: news.publishNow
        ? 'メンズエステランキングにニュースを投稿しました。'
        : `メンズエステランキングにニュースを投稿しました（公開開始: ${appliedPublishHour || ''}時〜）。`,
    };
  } catch (error: any) {
    const pageTitle = await page.title().catch(() => 'unknown');
    const pageUrl = page.url();
    console.error('[EstheRankingNewsSync] Error:', error, 'Page Title:', pageTitle, 'URL:', pageUrl);
    return { success: false, error: `${error.message} (画面タイトル: ${pageTitle}, URL: ${pageUrl})` };
  } finally {
    if (browser) {
      try { await Promise.all(browser.contexts().map((c: any) => c.close())); } catch (e) {}
      await browser.close();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
