// M1 look-test review screenshots. Run with the dev server up:  npm run shots
// Writes PNGs to review/m1/. Uses the dev-only window.__hoop hook to switch fabric, zoom and lamp.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'review/m1';
const fabrics = ['cotton', 'linen', 'aida14', 'felt'] as const;
// Quadrant detail spots (back stitch, running stitch, knots) for each thread material.
const details = { floss: [-28, 15], perle: [28, 15], silk: [-28, -15], wool: [28, -15] } as const;

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

async function settle(page: Page) {
  await page.evaluate(() => window.__hoop!.flush(4));
}

async function set(page: Page, patch: Record<string, unknown>) {
  await page.evaluate((p) => window.__hoop!.set(p), patch);
  await settle(page);
}

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

test('look test: every fabric at 1×, 3×, 8× plus material close-ups', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?ui=0&demo=1&hoop=1');
  await page.waitForFunction(() => !!window.__hoop);
  await settle(page);

  for (const fabric of fabrics) {
    await set(page, { fabric, zoom: 1, focus: { x: 0, y: 0 }, lampFollowsCamera: true });
    for (const zoom of [1, 3, 8]) {
      await set(page, { zoom, focus: { x: 0, y: 0 } });
      await page.screenshot({ path: `${OUT}/${fabric}-${zoom}x.png` });
    }
    for (const [mat, [x, y]] of Object.entries(details)) {
      await set(page, { zoom: 8, focus: { x, y } });
      await page.screenshot({ path: `${OUT}/${fabric}-8x-${mat}.png` });
    }
  }
  expect(errors).toEqual([]);
});

test('lamp sweep: silk shimmer changes as the lamp moves', async ({ page }) => {
  await page.goto('/?ui=0&demo=1&hoop=1');
  await page.waitForFunction(() => !!window.__hoop);
  await settle(page);
  await set(page, { fabric: 'cotton', zoom: 3, focus: { x: 0, y: 0 } });
  const spots = [
    ['left', -35, 0],
    ['centre', 0, 0],
    ['right', 35, 0],
  ] as const;
  for (const [name, x, y] of spots) {
    await set(page, { lampFollowsCamera: false, lampPos: { x, y } });
    await page.screenshot({ path: `${OUT}/lamp-sweep-${name}.png` });
  }
  for (const [name, x, y] of spots) {
    await set(page, {
      zoom: 8,
      focus: { x: -9, y: -5.5 },
      lampFollowsCamera: false,
      lampPos: { x: x - 9, y: y - 5.5 },
    });
    await page.screenshot({ path: `${OUT}/lamp-sweep-silk-8x-${name}.png` });
  }
});

test('zoom sweep: weave fades smoothly with no moiré', async ({ page }) => {
  await page.goto('/?ui=0&demo=1&hoop=1');
  await page.waitForFunction(() => !!window.__hoop);
  await settle(page);
  for (const fabric of ['cotton', 'linen', 'aida14'] as const) {
    for (const zoom of [1, 1.3, 1.7, 2.2, 3, 4.5]) {
      // A plain-fabric area away from the stitches.
      await set(page, { fabric, zoom, focus: { x: 0, y: 48 }, lampFollowsCamera: true });
      await page.screenshot({
        path: `${OUT}/zoom-sweep-${fabric}-${zoom}x.png`,
        clip: { x: 520, y: 250, width: 400, height: 400 },
      });
    }
  }
});
