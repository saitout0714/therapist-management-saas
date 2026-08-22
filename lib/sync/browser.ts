/**
 * ポータル同期(エステ魂・メンズエステランキング・エステラブ)で使うChromium起動処理を
 * 一箇所にまとめたもの。以前は各ポータルのファイルにほぼ同じ内容がコピーされていたため、
 * SSH経由プロキシ(ssh-relay.ts)を差し込む変更が7ファイルに散らばらないよう、ここに集約した。
 *
 * 呼び出し元が useRelay:true を渡した場合のみ、契約中のレンタルサーバーを経由して
 * ポータルへアクセスする(VercelサーバーのIPが403で弾かれる問題への対処。詳細はssh-relay.ts)。
 *
 * どのサーバーを経由するかは relayPrefix で選ぶ(省略時は 'SSH_RELAY' = さくら)。
 * ポータルによってどのIPなら通るかが違う(2026-08-22実測)ため、サイトごとに指定が要る。
 *   - エステラブ: relayPrefix省略(さくら)
 *   - メンズエステランキング: relayPrefix: 'RANKING_RELAY'(ConoHa WING)
 *     ※さくら経由だとTCP接続自体が応答なしになり、ConoHa WING経由だと通ることを確認済み
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

export async function getBrowser(options: { useRelay?: boolean; relayPrefix?: string } = {}): Promise<any> {
  const isLocal = !!process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.NODE_ENV === 'development' || !process.env.VERCEL;

  const relay = options.useRelay ? await startSshSocksRelay(options.relayPrefix) : null;
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
