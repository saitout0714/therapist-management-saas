import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { startSshSocksRelay } = await import('../lib/sync/ssh-relay');
  console.log('SSHトンネル + SOCKS5サーバーを起動します...');
  const relay = await startSshSocksRelay();
  if (!relay) {
    console.error('環境変数が不足しています(SSH_RELAY_HOST/PORT/USER/PRIVATE_KEY)');
    process.exit(1);
  }
  console.log('起動しました:', relay.server);

  const { SocksProxyAgent } = await import('socks-proxy-agent');
  const agent = new SocksProxyAgent(relay.server);
  const https = await import('https');

  const urls = [
    'https://estama.jp/login/?r=/admin/',
    'https://www.esthe-ranking.jp/login/',
    'https://eslove.jp/admin/login',
  ];

  for (const url of urls) {
    const start = Date.now();
    await new Promise<void>((resolve) => {
      const req = https.request(url, { agent }, (r) => {
        let size = 0;
        r.on('data', (chunk) => { size += chunk.length; });
        r.on('end', () => {
          console.log(`${url} -> status=${r.statusCode} size=${size} time=${Date.now() - start}ms`);
          resolve();
        });
      });
      req.on('error', (err) => {
        console.log(`${url} -> エラー: ${err.message}`);
        resolve();
      });
      req.end();
    });
  }

  // 上のhttpsリクエストはNodeのsocks-proxy-agent経由であり、本番が実際に使う経路
  // （Playwrightのchromiumに proxy を渡す）とは別物。chromiumはSOCKS5で
  // 並行に複数接続を張るため、Nodeで1本ずつ試したときには出ない問題が起きうる。
  // 本番と同じ経路で通るところまで確認する。
  console.log('\nchromium経由で同じことを確認します...');
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({
    headless: true,
    args: process.platform === 'win32' ? [] : ['--no-sandbox', '--disable-setuid-sandbox'],
    proxy: { server: relay.server },
  });
  try {
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });
    for (const url of urls) {
      const start = Date.now();
      try {
        const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const hasPassword = !!(await page.$('input[type="password"]'));
        console.log(
          `${url} -> status=${res?.status() ?? '不明'} パスワード欄=${hasPassword ? 'あり' : 'なし'} time=${Date.now() - start}ms`
        );
      } catch (e: any) {
        console.log(`${url} -> エラー: ${String(e.message).split('\n')[0]}`);
      }
    }
  } finally {
    await browser.close();
  }

  relay.close();
  console.log('トンネルを閉じました。');
}

main().catch((e) => {
  console.error('エラー:', e);
  process.exit(1);
});
