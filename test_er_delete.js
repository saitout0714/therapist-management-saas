
const { chromium } = require("playwright");
async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();
  await page.goto("https://www.esthe-ranking.jp/login/");
  await page.fill("input[name=\"loginname\"]", "cocororinse");
  await page.fill("input[name=\"password\"]", "Cocoro0701");
  await Promise.all([
    page.waitForNavigation(),
    page.click("form[action=\"/login/\"] button[type=\"submit\"]")
  ]);
  
  const photoDetailUrl = "https://www.esthe-ranking.jp/shop/image/girl/upload/detail/1726691/";
  await page.goto(photoDetailUrl);
  
  const html = await page.content();
  const fs = require("fs");
  fs.writeFileSync("er_photo_page.html", html);
  console.log("Saved er_photo_page.html");
  
  await browser.close();
}
run();

