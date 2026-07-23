
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
  
  while (true) {
    const formNames = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a.btn-danger")).map(a => {
        const match = a.getAttribute("onclick")?.match(/document\.(post_[^.]+)\.submit/);
        return match ? match[1] : null;
      }).filter(Boolean);
    });
    
    if (formNames.length === 0) break;
    
    console.log("Deleting form", formNames[0]);
    await Promise.all([
      page.waitForNavigation(),
      page.evaluate((name) => document[name].submit(), formNames[0])
    ]);
  }
  
  console.log("All deleted.");
  const html = await page.content();
  console.log("Has file[1]:", html.includes("name=\"file[1]\""));
  
  await browser.close();
}
run();

