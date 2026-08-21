/**
 * ポータル同期(エステ魂・メンズエステランキング・エステラブ)で使うChromium起動処理を
 * 一箇所にまとめたもの。以前は各ポータルのファイルにほぼ同じ内容がコピーされていたため、
 * SSH経由プロキシ(ssh-relay.ts)を差し込む変更が7ファイルに散らばらないよう、ここに集約した。
 *
 * SSH_RELAY_* の環境変数が設定されていて、かつ呼び出し元が useRelay:true を渡した場合のみ、
 * さくらのレンタルサーバーを経由してポータルへアクセスする(VercelサーバーのIPが403で
 * 弾かれる問題への対処。詳細はssh-relay.ts)。呼び出し元ごとに使う/使わないを選べるようにして
 * いるのは、エステラブは中継すると403を回避できる一方、メンズエステランキングは中継越しだと
 * 応答自体が返らずタイムアウトするだけで、直接アクセス時の速い403失敗より遅くなるだけの
 * 逆効果だったため(2026-08-21 実測)。ランキング側の遮断方式が分かるまでは中継を使わない。
 */
import { chromium as playwrightLocal } from 'playwright';
import { startSshSocksRelay } from './ssh-relay';

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

export async function getBrowser(options: { useRelay?: boolean } = {}): Promise<any> {
  const isLocal = !!process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.NODE_ENV === 'development' || !process.env.VERCEL;

  const relay = options.useRelay ? await startSshSocksRelay() : null;
  const proxy = relay ? { server: relay.server } : undefined;

  let browser: any;
  if (isLocal) {
    // CHROMIUM_ARGS はLinuxサーバーレス向けの設定で、--single-process 等は
    // WindowsではChromiumがクラッシュするため、Windowsでは引数なしで起動する
    browser = await playwrightLocal.launch({
      headless: true,
      args: process.platform === 'win32' ? [] : CHROMIUM_ARGS,
      proxy,
    });
  } else {
    const { chromium: playwrightCore } = await import('playwright-core');
    const chromium = (await import('@sparticuz/chromium')).default;
    chromium.setGraphicsMode = false;

    browser = await playwrightCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
      proxy,
    });
  }

  if (relay) {
    browser.on('disconnected', () => relay.close());
  }

  return browser;
}
