
const { chromium } = require("playwright");
async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("https://www.esthe-ranking.jp/shop/43180/cast/");
  const html = await page.content();
  console.log("Is Saito public?", html.includes("‚Vì°ç˜óÊéq"));
  await browser.close();
}
run();

