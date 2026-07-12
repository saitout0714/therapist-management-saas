const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function run() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Navigating...");
  await page.goto('http://localhost:10016/schedule/');
  
  console.log("Waiting 5s...");
  await page.waitForTimeout(5000);
  
  console.log("Taking screenshot...");
  const screenshotPath = 'c:/Users/saitou-cyberpunk/Desktop/yoyakukanri/therapist-management-saas/scratch/screenshot.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  
  const destDir = 'C:/Users/saitou-cyberpunk/.gemini/antigravity-ide/brain/d37752cb-39d2-4d4a-a59a-8c0942e657c1';
  if (fs.existsSync(destDir)) {
    fs.copyFileSync(screenshotPath, path.join(destDir, 'kokororinse_issue.png'));
    console.log("Copied screenshot to artifacts as kokororinse_issue.png");
  }
  
  await browser.close();
}
run().catch(err => console.error("Error:", err));
