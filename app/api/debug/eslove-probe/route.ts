/**
 * 【一時的な調査用エンドポイント】
 *
 * エステラブが本番(Vercel)からのアクセスを403で拒否する原因を切り分けるためのもの。
 * 「接続元IPが弾かれている」のか「こちらの送り方（ヘッダやブラウザの種類）が
 * 弾かれている」のかを判別する。切り分けが終わったら削除すること。
 *
 * アクセス先は eslove.jp のログインページに固定しており、任意のURLは指定できない。
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TARGET = 'https://eslove.jp/admin/login';
const TOKEN = 'probe-3f9c1a7d';

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
};

/** ページ本文がログインフォームを含むか（=正常なページか）を判定する */
function looksLikeLoginPage(html: string): boolean {
  return html.includes('login_password') || html.includes('LoginForm');
}

async function probeFetch(label: string, headers: Record<string, string>) {
  const started = Date.now();
  try {
    const res = await fetch(TARGET, { headers, redirect: 'manual' });
    const body = await res.text().catch(() => '');
    return {
      label,
      status: res.status,
      server: res.headers.get('server'),
      contentLength: body.length,
      hasLoginForm: looksLikeLoginPage(body),
      bodyHead: body.slice(0, 120).replace(/\s+/g, ' '),
      ms: Date.now() - started,
    };
  } catch (e: any) {
    return { label, error: e.message, ms: Date.now() - started };
  }
}

async function probeBrowser() {
  const started = Date.now();
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

    const context = await browser.newContext({
      userAgent: BROWSER_HEADERS['User-Agent'],
      locale: 'ja-JP',
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    const res = await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const html = await page.content();

    return {
      label: 'playwright(@sparticuz/chromium)',
      status: res?.status() ?? null,
      title: await page.title().catch(() => null),
      contentLength: html.length,
      hasLoginForm: looksLikeLoginPage(html),
      bodyHead: html.slice(0, 120).replace(/\s+/g, ' '),
      chromiumArgs: chromium.args.length,
      ms: Date.now() - started,
    };
  } catch (e: any) {
    return { label: 'playwright(@sparticuz/chromium)', error: e.message, ms: Date.now() - started };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
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

  const results = [];
  results.push(await probeFetch('fetch: ブラウザ相当のヘッダあり', BROWSER_HEADERS));
  results.push(await probeFetch('fetch: ヘッダなし(既定)', {}));
  results.push(await probeFetch('fetch: UAのみ', { 'User-Agent': BROWSER_HEADERS['User-Agent'] }));
  results.push(await probeBrowser());

  return NextResponse.json({
    outboundIp,
    region: process.env.VERCEL_REGION || null,
    results,
  });
}
