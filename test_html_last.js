
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
    
    await page.goto("https://www.esthe-ranking.jp/shop/image/girl/upload/all/", { waitUntil: "domcontentloaded" });
    const htmls = await page.evaluate(() => {
        const trs = Array.from(document.querySelectorAll("table.table-list tr"));
        return trs.slice(-3).map(tr => tr.innerHTML);
    });
    console.log("Last 3 rows HTML:", htmls);
    await browser.close();
}
run();

