
const { chromium } = require("playwright");
async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();
  const response = await page.goto("https://www.esthe-ranking.jp/login/");
  console.log("Status:", response.status());
  await browser.close();
}
run();

