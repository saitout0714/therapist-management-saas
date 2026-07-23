
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const https = require("https");
const os = require("os");

function downloadImageToTemp(url, prefix) {
  return new Promise((resolve) => {
    const tmpPath = path.join(os.tmpdir(), prefix + Date.now() + ".jpg");
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

    console.log("--- TEST ER REAL PHOTO UPLOAD ---");
    await page.goto("https://www.esthe-ranking.jp/login/", { waitUntil: "load" });
    await page.fill("input[name=\"loginname\"]", "cocororinse");
    await page.fill("input[name=\"password\"]", "Cocoro0701");
    await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
        page.click("form[action=\"/login/\"] button[type=\"submit\"]")
    ]);
    
    // ‚Vì°ç˜óÊéq is ID 1700971
    await page.goto("https://www.esthe-ranking.jp/shop/image/girl/upload/detail/1700971/", { waitUntil: "domcontentloaded" });
    console.log("On ER upload page:", page.url());
    
    let uploadedAny = false;
    for (let i = 0; i < photoUrls.length; i++) {
        const url = photoUrls[i];
        const tmp = await downloadImageToTemp(url, "er_img_" + i + "_");
        console.log("Downloaded photo", i, "to", tmp);
        if (tmp) {
            const input = await page.$("input[name=\"file[" + (i + 1) + "]\"]");
            if (input) {
                await input.setInputFiles(tmp);
                uploadedAny = true;
                console.log("Set photo", i, "in file input");
            } else {
                console.log("File input NOT FOUND for index", i);
            }
        }
    }

    if (uploadedAny) {
        await Promise.all([
            page.waitForNavigation({ waitUntil: "domcontentloaded" }),
            page.evaluate(() => {
                const photoForm = document.querySelector("form[action*=\"change_file\"]");
                if (photoForm) photoForm.submit();
            })
        ]);
        console.log("Submitted ER photo form!");
    }

    await browser.close();
}
run();

