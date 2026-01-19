import { chromium } from 'playwright';

async function takeScreenshot() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });

  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');

  const timestamp = Date.now();
  await page.screenshot({ path: `/tmp/screenshot-${timestamp}.png`, fullPage: false });
  console.log(`Screenshot saved: /tmp/screenshot-${timestamp}.png`);

  await browser.close();
}

takeScreenshot();
