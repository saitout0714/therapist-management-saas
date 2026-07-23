
const { chromium } = require("playwright");
async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("https://www.esthe-ranking.jp/login/", { waitUntil: "load" });
    await page.fill("input[name=\"loginname\"]", "cocororinse");
    await page.fill("input[name=\"password\"]", "Cocoro0701");
    await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
        page.click("form[action=\"/login/\"] button[type=\"submit\"]")
    ]);
    await page.goto("https://www.esthe-ranking.jp/shop/image/girl/upload/detail/1700971/", { waitUntil: "domcontentloaded" });
    await page.screenshot({ path: "er_upload_1700971.png" });
    await browser.close();
}
run();

