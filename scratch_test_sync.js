const { syncScraperSite } = require('./lib/sync/scraper');

async function testSync() {
  console.log("=== 同期処理のマッチングテスト開始 ===");
  const sites = ['バカラ周南下松', 'バカラ山口湯田', 'バカラ宇部', 'バカラ岩国'];

  for (const siteName of sites) {
    console.log(`\n------------------ ${siteName} ------------------`);
    await syncScraperSite(
      siteName,
      '2026-07-25',
      1,
      true, // dryRun
      true,
      true,
      true,
      (msg) => process.stdout.write(msg)
    );
  }
}

testSync();
