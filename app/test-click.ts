import { chromium } from 'playwright';

async function testClick() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });

  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');

  // Click on the second item (Jan 18)
  await page.click('text=Jan 18, 2026');
  await page.waitForTimeout(300);

  const timestamp = Date.now();
  await page.screenshot({ path: `/tmp/screenshot-click-${timestamp}.png`, fullPage: false });
  console.log(`Screenshot saved: /tmp/screenshot-click-${timestamp}.png`);

  await browser.close();
}

testClick();
