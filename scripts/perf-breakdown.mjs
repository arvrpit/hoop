// Quick breakdown of the 20k-stitch frame: with/without shadows. node e2e/perf-breakdown.mjs
import { chromium } from '@playwright/test';
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:5183/?stress=20000&fabric=linen&zoom=3');
await p.waitForFunction(() => !!window.__hoopBench && (window.__hoopFrames ?? 0) > 10);
for (const shadows of [true, false]) {
  await p.evaluate((s) => window.__hoop.set({ shadows: s }), shadows);
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => window.__hoopBench(120));
  console.log(`shadows ${shadows}: ${r.msPerFrame.toFixed(2)} ms`);
}
await b.close();
