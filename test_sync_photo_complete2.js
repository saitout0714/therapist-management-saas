
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const https = require("https");

function downloadImageToTemp(url, prefix) {
  return new Promise((resolve) => {
    const tmpPath = path.join(__dirname, prefix + Date.now() + ".jpg");
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        const stream = fs.createWriteStream(tmpPath);
        res.pipe(stream);
        stream.on("finish", () => {
          stream.close();
          resolve(tmpPath);
        });
      } else {
        resolve(null);
      }
    }).on("error", () => resolve(null));
  });
}

async function run() {
    const photoUrls = [
      "https://pumkniqtgjsotsxhyvbq.supabase.co/storage/v1/object/public/therapist-photos/efa75b28-06da-4238-8d1c-d2c07e12b8aa/f8f90ba4-8433-4f8c-8217-a5afcbc7685d.jpg",
      "https://pumkniqtgjsotsxhyvbq.supabase.co/storage/v1/object/public/therapist-photos/efa75b28-06da-4238-8d1c-d2c07e12b8aa/dc428390-9892-4d85-88d9-7e580e4f68a8.webp"
    ];

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("--- TEST ESTAMA MULTI PHOTO ---");
    await page.goto("https://estama.jp/login/?r=/admin/", { waitUntil: "load", timeout: 15000 });
    await page.locator("input[name=\"mail\"], input[name=\"loginname\"], input[type=\"email\"], input[type=\"text\"]").first().fill("cocoro.rinse@gmail.com");
    await page.locator("input[name=\"password\"], input[type=\"password\"]").first().fill("masa1234");
    await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {}),
        page.locator("button[type=\"submit\"], input[type=\"submit\"], form button, .login-btn, a[type=\"submit\"], a.send-post").first().click()
    ]);
    
    await page.goto("https://estama.jp/admin/cast_edit/925769/", { waitUntil: "domcontentloaded" });
    
    const tmpFiles = [];
    for (let i = 0; i < photoUrls.length; i++) {
        const tmp = await downloadImageToTemp(photoUrls[i], "estama_" + i + "_");
        if (tmp) {
            tmpFiles.push(tmp);
            const inputSelector = "#cast_icon_" + (i + 1);
            const input = await page.$(inputSelector);
            if (input) {
                await input.setInputFiles(tmp);
                console.log("Uploaded photo " + (i + 1) + " to Estama");
            }
        }
    }

    await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {}),
        page.evaluate(() => document.querySelector("form").submit())
    ]);
    console.log("Estama Photo Save Complete!");

    console.log("--- TEST ER MULTI PHOTO ---");
    await page.goto("https://www.esthe-ranking.jp/login/", { waitUntil: "load", timeout: 15000 });
    await page.fill("input[name=\"loginname\"]", "cocororinse");
    await page.fill("input[name=\"password\"]", "Cocoro0701");
    await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {}),
        page.click("form[action=\"/login/\"] button[type=\"submit\"]")
    ]);
    
    await page.goto("https://www.esthe-ranking.jp/shop/image/girl/upload/detail/1700960/", { waitUntil: "domcontentloaded" });
    
    for (let i = 0; i < photoUrls.length; i++) {
        const tmp = await downloadImageToTemp(photoUrls[i], "er_" + i + "_");
        if (tmp) {
            tmpFiles.push(tmp);
            const inputSelector = "input[name=\"file[" + (i + 1) + "]\"]";
            const input = await page.$(inputSelector);
            if (input) {
                await input.setInputFiles(tmp);
                console.log("Uploaded photo " + (i + 1) + " to ER");
            }
        }
    }

    await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {}),
        page.evaluate(() => {
            const f = document.querySelector("form[action*=\"change_file\"]");
            if (f) f.submit();
        })
    ]);
    console.log("ER Photo Save Complete!");

    await browser.close();
    tmpFiles.forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });
}
run();

