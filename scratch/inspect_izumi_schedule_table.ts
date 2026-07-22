import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Logging in...');
  await page.goto('https://estama.jp/login/');
  await page.fill('input[name="mail"]', 'cocoro.rinse@gmail.com');
  await page.fill('input[name="password"]', 'masa1234');
  await page.click('a.send-post');
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });

  // Izumi's schedule page
  console.log('Navigating to Izumi schedule page (624894)...');
  await page.goto('https://estama.jp/admin/schedule/624894/', { waitUntil: 'domcontentloaded' });

  console.log('Page URL:', page.url());
  console.log('Page Title:', await page.title());

  // Check headers (dates) in the table
  const headers = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('th')).map(th => th.textContent?.trim());
  });
  console.log('Table headers (Dates):', headers);

  // Check shifts/options for 7/25
  const tableData = await page.evaluate(() => {
    const trs = Array.from(document.querySelectorAll('tr'));
    return trs.map(tr => {
      const time = tr.querySelector('th')?.textContent?.trim() || '';
      const cells = Array.from(tr.querySelectorAll('td')).map(td => {
        const sel = td.querySelector('select');
        return sel ? { val: sel.value, text: sel.options[sel.selectedIndex]?.text } : td.textContent?.trim();
      });
      return { time, cells };
    }).filter(row => row.time || row.cells.length > 0);
  });

  console.log('Table rows sample (first 15):', JSON.stringify(tableData.slice(0, 15), null, 2));

  await browser.close();
}

main();
