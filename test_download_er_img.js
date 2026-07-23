
const { chromium } = require("playwright");
const fs = require("fs");
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
  
  const imgUrl = "https://www.esthe-ranking.jp/uploads/girl-000000cb98-6a62324f3f539.jpg";
  const response = await page.goto(imgUrl);
  const buffer = await response.body();
  fs.writeFileSync("test_er_img_slot2.jpg", buffer);
  console.log("Size:", buffer.length);
  await browser.close();
}
run();

