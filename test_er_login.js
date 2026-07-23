
const { chromium } = require("playwright");
async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const response = await page.goto("https://www.esthe-ranking.jp/login/");
  console.log("Status:", response.status());
  await browser.close();
}
run();

