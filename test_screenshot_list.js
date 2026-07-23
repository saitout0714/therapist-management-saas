
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
    
    // Therapist list page
    await page.goto("https://www.esthe-ranking.jp/shop/therapist/", { waitUntil: "domcontentloaded" });
    await page.screenshot({ path: "er_therapist_list.png" });

    // Try finding the photo edit link for the first therapist
    const firstPhotoLink = await page.$eval("a[href*=\"/shop/image/girl/upload/detail/\"]", el => el.href).catch(() => "none");
    console.log("First photo link:", firstPhotoLink);
    
    // Photo management page
    await page.goto("https://www.esthe-ranking.jp/shop/image/girl/upload/all/", { waitUntil: "domcontentloaded" });
    await page.screenshot({ path: "er_photo_all.png", fullPage: true });

    await browser.close();
}
run();

