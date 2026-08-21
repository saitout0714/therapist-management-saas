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

  relay.close();
  console.log('トンネルを閉じました。');
}

main().catch((e) => {
  console.error('エラー:', e);
  process.exit(1);
});
