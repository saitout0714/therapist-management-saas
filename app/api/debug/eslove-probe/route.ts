/**
 * 【一時的な調査用エンドポイント】
 *
 * 3つのポータルに対して「素のリクエスト」と「実ブラウザ(Playwright)」の
 * 両方でアクセスし、どちらが弾かれるのかを本番環境から実測する。
 * 切り分けが終わったら削除すること。
 *
 * アクセス先は下記3件に固定しており、任意のURLは指定できない。
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TOKEN = 'probe-3f9c1a7d';

const TARGETS: Record<string, string> = {
  eslove: 'https://eslove.jp/admin/login',
  ranking: 'https://www.esthe-ranking.jp/login/',
  estama: 'https://estama.jp/login/?r=/admin/',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  'Upgrade-Insecure-Requests': '1',
};

/** ログインフォームが実際に描画されているか（サイトごとの目印で判定） */
function hasLoginForm(site: string, html: string): boolean {
  if (site === 'eslove') return html.includes('login_password') || html.includes('LoginForm');
  if (site === 'ranking') return html.includes('loginname');
  return html.includes('password');
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('token') !== TOKEN) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const outboundIp = await fetch('https://api.ipify.org?format=json')
    .then(r => r.json())
    .then((d: any) => d.ip)
    .catch(() => 'unknown');

  const results: any[] = [];

  // 1) 素のリクエスト
  for (const [site, url] of Object.entries(TARGETS)) {
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'manual' });
      const body = await res.text().catch(() => '');
      results.push({ site, method: 'fetch', status: res.status, size: body.length, form: hasLoginForm(site, body) });
    } catch (e: any) {
      results.push({ site, method: 'fetch', error: e.message });
    }
  }

  // 2) 実ブラウザ（実際の同期処理と同じ構成）
  let browser: any;
  try {
    const { chromium: playwrightCore } = await import('playwright-core');
    const chromium = (await import('@sparticuz/chromium')).default;
    chromium.setGraphicsMode = false;
    browser = await playwrightCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const context = await browser.newContext({ userAgent: UA, locale: 'ja-JP', viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    for (const [site, url] of Object.entries(TARGETS)) {
      try {
        const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const html = await page.content();
        results.push({
          site,
          method: 'browser',
          status: res?.status() ?? null,
          size: html.length,
          form: hasLoginForm(site, html),
          title: await page.title().catch(() => null),
        });
      } catch (e: any) {
        results.push({ site, method: 'browser', error: e.message });
      }
    }
  } catch (e: any) {
    results.push({ site: 'all', method: 'browser', error: `起動失敗: ${e.message}` });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  return NextResponse.json({ outboundIp, region: process.env.VERCEL_REGION || null, results });
}
