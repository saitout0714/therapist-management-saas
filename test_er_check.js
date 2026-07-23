
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
  console.log("Slot 1 image:", html.match(/<img[^>]*data-gcva-key="1726691"[^>]*data-gcva-num="11"[^>]*>/));
  console.log("Slot 2 image:", html.match(/<img[^>]*data-gcva-key="1726691"[^>]*data-gcva-num="12"[^>]*>/));
  console.log("Slot 3 image:", html.match(/<img[^>]*data-gcva-key="1726691"[^>]*data-gcva-num="13"[^>]*>/));
  
  await browser.close();
}
run();

