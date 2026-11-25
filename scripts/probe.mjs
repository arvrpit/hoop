// Render a URL headlessly, print GPU renderer + console errors, save a screenshot.
// Usage: node scripts/probe.mjs "http://localhost:5183/?ui=0" out.png [x,y,w,h clip in CSS px]
import { chromium } from '@playwright/test';
const url = process.argv[2] || 'http://localhost:5183/?ui=0';
const out = process.argv[3] || 'probe.png';
const browser = await chromium.launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const logs = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text().slice(0, 1500)}`);
});
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
await page.goto(url);
await page.waitForFunction(() => !!window.__hoop, null, { timeout: 60000 }).catch(() => logs.push('hook timeout'));
await page.evaluate(() => window.__hoop?.flush(6));
if (process.env.PROBE_JS) await page.evaluate(process.env.PROBE_JS);
await page.evaluate(() => window.__hoop?.flush(6));
const info = await page.evaluate(() => {
  const c = document.createElement('canvas').getContext('webgl2');
  const ext = c && c.getExtension('WEBGL_debug_renderer_info');
  return { renderer: ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a', frames: window.__hoopFrames };
});
const clip = process.argv[4]
  ? (([x, y, width, height]) => ({ x, y, width, height }))(process.argv[4].split(',').map(Number))
  : undefined;
await page.screenshot({ path: out, clip });
console.log(JSON.stringify(info));
console.log(logs.slice(0, 12).join('\n'));
await browser.close();
