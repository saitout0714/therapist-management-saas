
const { chromium } = require("playwright");
const fs = require("fs");
async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const webpUrl = "https://pumkniqtgjsotsxhyvbq.supabase.co/storage/v1/object/public/therapist-photos/efa75b28-06da-4238-8d1c-d2c07e12b8aa/dc428390-9892-4d85-88d9-7e580e4f68a8.webp";
  
  const jpegDataUrl = await page.evaluate(async (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.onerror = (e) => reject("Failed to load image");
      img.src = url;
    });
  }, webpUrl);
  
  const base64Data = jpegDataUrl.replace(/^data:image\/jpeg;base64,/, "");
  fs.writeFileSync("converted.jpg", base64Data, "base64");
  console.log("Converted successfully!");
  await browser.close();
}
run();

