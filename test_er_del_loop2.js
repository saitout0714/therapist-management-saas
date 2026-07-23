
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
  
  page.on("dialog", dialog => {
    console.log("Dialog message:", dialog.message());
    dialog.accept();
  });
  
  while (true) {
    const delBtns = await page.$$("a.btn-danger");
    let deleted = false;
    for (const btn of delBtns) {
      const text = await btn.innerText();
      if (text.includes("çÌèú")) {
        console.log("Deleting a photo...");
        await Promise.all([
          page.waitForNavigation(),
          btn.click()
        ]);
        deleted = true;
        break; // break to re-evaluate the page
      }
    }
    if (!deleted) break;
  }
  
  console.log("All photos deleted.");
  
  const html = await page.content();
  console.log("Has file[1]:", html.includes("name=\"file[1]\""));
  
  await browser.close();
}
run();

