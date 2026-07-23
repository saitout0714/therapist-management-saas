const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        const stream = fs.createWriteStream(filepath);
        res.pipe(stream);
        stream.on('finish', () => {
          stream.close();
          resolve(filepath);
        });
      } else {
        reject(new Error('Failed to download image'));
      }
    }).on('error', reject);
  });
}

async function run() {
    const photoUrl = "https://pumkniqtgjsotsxhyvbq.supabase.co/storage/v1/object/public/therapist-photos/efa75b28-06da-4238-8d1c-d2c07e12b8aa/f8f90ba4-8433-4f8c-8217-a5afcbc7685d.jpg";
    const tmpFile = path.join(__dirname, 'test_upload.jpg');
    await downloadImage(photoUrl, tmpFile);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- TEST ER PHOTO UPLOAD BUTTON ---');
    await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'load', timeout: 15000 });
    await page.fill('input[name=\"loginname\"]', 'cocororinse');
    await page.fill('input[name=\"password\"]', 'Cocoro0701');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.click('form[action=\"/login/\"] button[type=\"submit\"]')
    ]);
    
    await page.goto('https://www.esthe-ranking.jp/shop/image/girl/upload/detail/1700960/', { waitUntil: 'domcontentloaded' });
    const erFileInput = page.locator('input[name=\"file[1]\"], input[type=\"file\"]').first();
    await erFileInput.setInputFiles(tmpFile);
    console.log('Set file input on ER!');

    // Check forms on ER edit detail
    const uploadBtn = page.locator('button:has-text(\"画像アップロード\"), input[value*=\"画像アップロード\"]').first();
    console.log('Upload btn text:', await uploadBtn.innerText().catch(() => 'none'));

    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        uploadBtn.click({ force: true })
    ]);
    console.log('ER after photo upload URL:', page.url());

    await browser.close();
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
}
run();
