
const { chromium } = require("playwright");
async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("https://www.esthe-ranking.jp/");
  
  try {
    const res = await page.evaluate(async () => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve("Success");
        img.onerror = () => reject("Failed");
        // tiny transparent gif
        img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      });
    });
    console.log("Result:", res);
  } catch (e) {
    console.error("Error:", e);
  }
  await browser.close();
}
run();

