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
    console.log('Downloaded temp file:', tmpFile);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- TEST ESTAMA PHOTO UPLOAD ---');
    await page.goto('https://estama.jp/login/?r=/admin/', { waitUntil: 'load', timeout: 15000 });
    await page.locator('input[name=\"mail\"], input[name=\"loginname\"], input[type=\"email\"], input[type=\"text\"]').first().fill('cocoro.rinse@gmail.com');
    await page.locator('input[name=\"password\"], input[type=\"password\"]').first().fill('masa1234');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('button[type=\"submit\"], input[type=\"submit\"], form button, .login-btn, a[type=\"submit\"], a.send-post').first().click()
    ]);
    
    // Go to edit cast 925769
    await page.goto('https://estama.jp/admin/cast_edit/925769/', { waitUntil: 'domcontentloaded' });
    const estamaFileInput = page.locator('#cast_icon_1, input[type=\"file\"]').first();
    await estamaFileInput.setInputFiles(tmpFile);
    console.log('Set file input on Estama!');

    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.evaluate(() => document.querySelector('form').submit())
    ]);
    console.log('Estama after photo save URL:', page.url());

    console.log('--- TEST ER PHOTO UPLOAD ---');
    await page.goto('https://www.esthe-ranking.jp/login/', { waitUntil: 'load', timeout: 15000 });
    await page.fill('input[name=\"loginname\"]', 'cocororinse');
    await page.fill('input[name=\"password\"]', 'Cocoro0701');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.click('form[action=\"/login/\"] button[type=\"submit\"]')
    ]);
    
    // Go to edit girl 1700960 or newly created
    await page.goto('https://www.esthe-ranking.jp/shop/image/girl/upload/detail/1700960/', { waitUntil: 'domcontentloaded' });
    const erFileInput = page.locator('input[name=\"file[1]\"], input[type=\"file\"]').first();
    await erFileInput.setInputFiles(tmpFile);
    console.log('Set file input on ER!');

    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        page.locator('button:has-text(\"‚±‚Ì“à—e‚Å•Û‘¶\"), button[type=\"submit\"]').first().click({ force: true })
    ]);
    console.log('ER after photo save URL:', page.url());

    await browser.close();
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
}
run();
