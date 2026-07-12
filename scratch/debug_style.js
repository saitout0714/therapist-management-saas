const { chromium } = require('playwright');

async function run() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Navigating...");
  await page.goto('http://localhost:10016/schedule/');
  
  console.log("Waiting 5s...");
  await page.waitForTimeout(5000);
  
  const styles = await page.evaluate(() => {
    const panel = document.querySelector('.yk-tab-panel.active');
    const card = document.querySelector('.yk-card');
    
    if (!panel) return { error: 'Active panel not found' };
    
    const panelStyle = window.getComputedStyle(panel);
    const result = {
      panel: {
        display: panelStyle.display,
        visibility: panelStyle.visibility,
        opacity: panelStyle.opacity,
        height: panelStyle.height
      }
    };
    
    if (card) {
      const cardStyle = window.getComputedStyle(card);
      result.card = {
        display: cardStyle.display,
        visibility: cardStyle.visibility,
        opacity: cardStyle.opacity,
        height: cardStyle.height,
        width: cardStyle.width
      };
    } else {
      result.card = { error: 'Card not found' };
    }
    
    return result;
  });
  
  console.log("Computed Styles:", JSON.stringify(styles, null, 2));
  
  await browser.close();
}
run().catch(err => console.error(err));
