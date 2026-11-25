// M1 performance check: 20,000 random stitches. Reports GPU ms/frame at 1×, 3× and 8× at
// 1440×900 @2× (a Retina laptop screen), plus the browser's measured frame rate.
import { test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

test('20k stitches frame time', async ({ page }) => {
  await page.goto('/?stress=20000&hoop=1');
  await page.waitForFunction(
    () => !!window.__hoopBench && !!window.__hoop && (window.__hoopFrames ?? 0) > 10,
  );
  const renderer = await page.evaluate(() => {
    const c = document.createElement('canvas').getContext('webgl2')!;
    const e = c.getExtension('WEBGL_debug_renderer_info');
    return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  console.log(`GPU: ${renderer}`);
  for (const mode of ['stress', 'demo'] as const) {
    await page.evaluate((m) => window.__hoop!.set({ source: m, fabric: 'linen', alwaysRender: true }), mode);
    for (const zoom of [1, 3, 8]) {
      await page.evaluate((z) => window.__hoop!.set({ zoom: z, focus: { x: 0, y: 0 } }), zoom);
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => window.__hoopBench!(120));
      await page.waitForTimeout(1500);
      const fps = await page.evaluate(() => window.__hoopFps ?? 0);
      console.log(
        `${mode === 'stress' ? '20k stitches' : 'demo piece '} ${zoom}×: ${r.msPerFrame.toFixed(2)} ms/frame GPU-synced ` +
          `(${(1000 / r.msPerFrame).toFixed(0)} fps max) at ${r.width}×${r.height}; rAF rate ${fps.toFixed(0)} fps`,
      );
    }
  }
});
