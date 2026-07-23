
const { chromium } = require("playwright");
const fs = require("fs");
async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const webpUrl = "https://pumkniqtgjsotsxhyvbq.supabase.co/storage/v1/object/public/therapist-photos/efa75b28-06da-4238-8d1c-d2c07e12b8aa/dc428390-9892-4d85-88d9-7e580e4f68a8.webp";
  const response = await fetch(webpUrl);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const dataUrl = `data:image/webp;base64,${base64}`;
  
  const jpegDataUrl = await page.evaluate(async (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "white"; // Add white background just in case
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.onerror = (e) => reject("Failed to load image");
      img.src = url;
    });
  }, dataUrl);
  
  const base64Data = jpegDataUrl.replace(/^data:image\/jpeg;base64,/, "");
  fs.writeFileSync("converted_base64.jpg", base64Data, "base64");
  console.log("Converted successfully using base64!");
  await browser.close();
}
run();

