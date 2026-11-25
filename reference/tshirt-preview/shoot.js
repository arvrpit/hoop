// Render screenshots of the preview page with headless Chromium.
const { chromium } = require('playwright');
const shots = JSON.parse(process.argv[2] || '[]');
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const s of shots) {
    const page = await browser.newPage({ viewport: { width: s.w || 1100, height: s.h || 1250 }, deviceScaleFactor: s.dpr || 1 });
    page.on('console', (m) => console.log(`[${s.out}]`, m.type(), m.text()));
    page.on('pageerror', (e) => console.log(`[${s.out}] pageerror`, e.message));
    await page.goto(`http://localhost:8765/web/index.html?${s.query}`);
    await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 240000 });
    const err = await page.evaluate(() => window.__error);
    if (err) { console.log('ERROR', err); continue; }
    await page.screenshot({ path: s.out });
    console.log('saved', s.out);
    await page.close();
  }
  await browser.close();
})();
