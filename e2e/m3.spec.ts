// M3 manual-QA script (SPEC §11 M3) automated, plus the new mode / platform / legend checks.
// Writes review screenshots and a short screen recording to review/m3/.
import { expect, test, type Page } from '@playwright/test';

import { mkdirSync, renameSync } from 'node:fs';

const OUT = 'review/m3';
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

type S = ReturnType<NonNullable<Window['__hoop']>['state']>;
const st = (page: Page) => page.evaluate(() => window.__hoop!.state()) as Promise<S>;
const ui = (page: Page) => page.locator('svg[aria-hidden="true"][data-visible]');

async function open(page: Page, query = '', platform: 'mac' | 'win' = 'mac') {
  await page.addInitScript((p) => {
    window.__hoopPlatform = p;
  }, platform);
  await page.goto(`/?hoop=1&panel=0${query ? `&${query}` : ''}`);
  await page.waitForFunction(() => !!window.__hoop && !!window.__hoopInteraction);
  await page.evaluate(() => window.__hoop!.flush(4));
}

async function screen(page: Page, x: number, y: number) {
  return page.evaluate(([px, py]) => window.__hoopInteraction!.toScreen({ x: px!, y: py! }), [x, y]);
}

async function settleCamera(page: Page) {
  await page.waitForFunction(() => !window.__hoop!.state().camera.gliding, null, { timeout: 5000 });
  await page.evaluate(() => window.__hoop!.flush(3));
}

/** Click a hoop position (mm) and wait for the stitch animation. */
async function stitchAt(page: Page, x: number, y: number, wait = 450) {
  const p = await screen(page, x, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(wait);
}

/** Jump to a zoom (the default jersey has 0.7 mm holes, so precise clicks need to be zoomed in). */
async function zoomTo(page: Page, zoom: number) {
  await page.evaluate((z) => window.__hoop!.set({ zoom: z }), zoom);
  await page.evaluate(() => window.__hoop!.flush(3));
}

const cam = async (page: Page) => JSON.stringify((await st(page)).camera);

test('1–2: clicking never moves the camera; a click makes a hole at any zoom', async ({ page }) => {
  await open(page);
  await page.keyboard.press('r');
  expect((await st(page)).tool).toBe('stitch');
  const before = await cam(page);
  await page.mouse.click(720, 450);
  await page.waitForTimeout(300);
  let s = await st(page);
  expect(s.punctures).toBe(1);
  expect(s.camera.zoom).toBe(1);
  expect(await cam(page)).toBe(before);

  await zoomTo(page, 3);
  const zoomed = await cam(page);
  await stitchAt(page, 5, 0);
  s = await st(page);
  expect(s.punctures).toBe(2);
  expect(s.front).toBe(1);
  expect(await cam(page)).toBe(zoomed);

  for (let i = 0; i < 40; i++) await page.mouse.move(500 + i * 12, 300 + (i % 7) * 40);
  await page.waitForTimeout(400);
  expect(await cam(page)).toBe(zoomed);
  await expect(ui(page)).toHaveAttribute('data-visible', '1');
  await page.screenshot({ path: `${OUT}/1-aiming.png` });
});

test('3: + and − zoom about the centre; the zoom control does the same', async ({ page }) => {
  await open(page);
  await page.keyboard.press('+');
  expect((await st(page)).camera.zoom).toBeCloseTo(1.25, 3);
  await page.keyboard.press('=');
  expect((await st(page)).camera.zoom).toBeCloseTo(1.5625, 3);
  await page.keyboard.press('-');
  expect((await st(page)).camera.zoom).toBeCloseTo(1.25, 3);
  expect((await st(page)).camera.focus).toEqual({ x: 0, y: 0 });
  await page.getByRole('button', { name: 'Zoom in' }).click();
  expect((await st(page)).camera.zoom).toBeCloseTo(1.5625, 3);
  await expect(page.getByLabel('Zoom level')).toHaveText('156%');
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  expect((await st(page)).camera.zoom).toBe(1); // never below the whole hoop
});

test('4: Fit (Shift+1 or the button) glides back to the whole hoop', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__hoop!.set({ zoom: 4, focus: { x: 20, y: -10 } }));
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(100);
  expect((await st(page)).camera.gliding).toBe(true);
  await settleCamera(page);
  let s = await st(page);
  expect(s.camera.zoom).toBe(1);
  expect(s.camera.focus).toEqual({ x: 0, y: 0 });
  expect(s.camera.mode).toBe('overview');

  await zoomTo(page, 2.5);
  await page.getByRole('button', { name: /Fit/ }).click();
  await settleCamera(page);
  s = await st(page);
  expect(s.camera.zoom).toBe(1);
});

test('Esc switches to the View tool and leaves the camera alone', async ({ page }) => {
  await open(page);
  await page.keyboard.press('b');
  await zoomTo(page, 3);
  const before = await cam(page);
  expect((await st(page)).tool).toBe('stitch');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__hoop!.flush(2));
  expect((await st(page)).tool).toBe('view');
  expect(await cam(page)).toBe(before);
  await expect(ui(page)).toHaveAttribute('data-visible', '0');
});

test('5–7: guidelines, slack and tug, unpick and redo', async ({ page }) => {
  await open(page);
  await page.keyboard.press('r');
  await zoomTo(page, 3);
  const g = () => ui(page).getAttribute('data-guide');

  // Running: no guideline before the first hole, then solid (on top) and dotted (underneath) alternate.
  let p = await screen(page, 2, 0);
  await page.mouse.move(p.x, p.y);
  expect(await g()).toBe('none');
  await stitchAt(page, 0, 0);
  p = await screen(page, 4, 0);
  await page.mouse.move(p.x, p.y);
  expect(await g()).toBe('front');
  await stitchAt(page, 4, 0);
  p = await screen(page, 6, 0);
  await page.mouse.move(p.x, p.y);
  expect(await g()).toBe('back');
  await page.screenshot({ path: `${OUT}/5-running-dotted-guide.png` });

  // Back stitch: always solid.
  await page.keyboard.press('b');
  await stitchAt(page, 0, 6);
  for (const x of [3, 6]) {
    p = await screen(page, x, 6);
    await page.mouse.move(p.x, p.y);
    expect(await g()).toBe('front');
    await stitchAt(page, x, 6);
  }
  p = await screen(page, 9, 6);
  await page.mouse.move(p.x, p.y);
  await page.screenshot({ path: `${OUT}/5-back-solid-guide.png` });

  // 15 mm: slack. 30 mm: refused with a tug, nothing stitched.
  p = await screen(page, 6, 6 - 15);
  await page.mouse.move(p.x, p.y);
  expect(await ui(page).getAttribute('data-slack')).toBe('1');
  await page.screenshot({ path: `${OUT}/6-slack-guide.png` });
  const front = (await st(page)).front;
  p = await screen(page, 6 - 30, 6);
  await page.mouse.move(p.x, p.y);
  const tugs = Number((await ui(page).getAttribute('data-tugs')) ?? 0);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(100);
  expect(Number(await ui(page).getAttribute('data-tugs'))).toBe(tugs + 1);
  await page.waitForTimeout(500);
  expect((await st(page)).front).toBe(front);

  // Undo unpicks (visible retract), redo stitches again.
  await page.keyboard.press('Meta+z');
  await page.evaluate(() => window.__hoop!.flush(2));
  await page.screenshot({ path: `${OUT}/7-unpicking.png` });
  await page.waitForTimeout(400);
  expect((await st(page)).front).toBe(front - 1);
  await page.keyboard.press('Shift+Meta+z');
  await page.waitForTimeout(500);
  expect((await st(page)).front).toBe(front);
});

test('8: with reduced motion Fit is an instant cut', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await zoomTo(page, 3);
  await page.keyboard.press('Shift+Digit1');
  await page.evaluate(() => window.__hoop!.flush(2));
  const s = await st(page);
  expect(s.camera.gliding).toBe(false);
  expect(s.camera.zoom).toBe(1);
});

test('View mode: no crosshair, clicks make no holes, drag pans', async ({ page }) => {
  await open(page);
  await page.keyboard.press('h');
  await zoomTo(page, 3);
  await page.mouse.move(700, 430);
  await expect(ui(page)).toHaveAttribute('data-visible', '0');
  await page.mouse.click(700, 430);
  await page.waitForTimeout(200);
  expect((await st(page)).punctures).toBe(0);
  const f0 = (await st(page)).camera.focus;
  await page.mouse.move(700, 430);
  await page.mouse.down();
  await page.mouse.move(600, 430, { steps: 5 });
  await page.mouse.up();
  const f1 = (await st(page)).camera.focus;
  expect(f1.x).toBeGreaterThan(f0.x + 3);
  await page.screenshot({ path: `${OUT}/view-mode.png` });
});

test('macOS: two-finger swipe pans, pinch zooms', async ({ page }) => {
  await open(page, '', 'mac');
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 120);
  await page.evaluate(() => window.__hoop!.flush(2));
  let s = await st(page);
  expect(s.camera.zoom).toBe(1);
  expect(s.camera.focus.y).toBeLessThan(0);
  await page.evaluate(() => {
    document.querySelector('canvas')!.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -60,
        ctrlKey: true,
        clientX: 720,
        clientY: 450,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  s = await st(page);
  expect(s.camera.zoom).toBeGreaterThan(1.5);
});

test('Windows: wheel zooms, Space + drag pans', async ({ page }) => {
  await open(page, '', 'win');
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, -300);
  await page.evaluate(() => window.__hoop!.flush(2));
  let s = await st(page);
  expect(s.camera.zoom).toBeGreaterThan(1.3);
  const f0 = s.camera.focus;
  await page.keyboard.down('Space');
  await page.mouse.down();
  await page.mouse.move(820, 450, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  s = await st(page);
  expect(s.camera.focus.x).toBeLessThan(f0.x - 3);
  expect(s.punctures).toBe(0);
  await expect(page.getByText('Space')).toBeVisible();
});

test('Legend: open on first visit, folds after the first stitch, ? toggles it', async ({ page }) => {
  await open(page);
  const header = page.getByRole('button', { name: /Controls/ });
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  await page.screenshot({ path: `${OUT}/legend-first-visit.png` });
  await page.keyboard.press('k');
  await stitchAt(page, 0, 0);
  await expect(header).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('?');
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('?');
  await expect(header).toHaveAttribute('aria-expanded', 'false');
});

test('Recording: stitching a small leaf and stem', async ({ browser }) => {
  const dir = `${OUT}/video-tmp`;
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir, size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__hoopPlatform = 'mac';
  });
  await page.goto('/?hoop=1&ui=0&panel=0');
  await page.waitForFunction(() => !!window.__hoop && !!window.__hoopInteraction);
  await page.evaluate(() => window.__hoop!.set({ hideUi: false }));
  await page.waitForTimeout(600);
  // Stem in back stitch. Zoom in with + (the camera never moves on its own).
  await page.keyboard.press('b');
  await page.mouse.move(640, 400, { steps: 10 });
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('+');
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(500);
  const pts = [
    [0, -12],
    [0, -9],
    [0.5, -6],
    [1, -3],
    [1.5, 0],
  ];
  for (const [x, y] of pts) {
    const p = await screen(page, x! * 1, y!);
    await page.mouse.move(p.x, p.y, { steps: 12 });
    await page.waitForTimeout(250);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(450);
  }
  await page.keyboard.press('t');
  // A satin leaf: stitches across a lens shape, leaning off the top of the stem.
  await page.keyboard.press('s');
  const ax = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
  const perp = { x: -ax.y, y: ax.x };
  const base = { x: 1.5 + 6 * ax.x, y: 6 * ax.y };
  for (let i = -5; i <= 5; i++) {
    const c = { x: base.x + ax.x * i * 0.6, y: base.y + ax.y * i * 0.6 };
    const h = 3.2 * Math.sqrt(Math.max(0.05, 1 - (i / 6) ** 2));
    const a = await screen(page, c.x - perp.x * h, c.y - perp.y * h);
    const b = await screen(page, c.x + perp.x * h, c.y + perp.y * h);
    await page.mouse.move(a.x, a.y, { steps: 8 });
    await page.waitForTimeout(150);
    await page.mouse.click(a.x, a.y);
    await page.waitForTimeout(300);
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.waitForTimeout(150);
    await page.mouse.click(b.x, b.y);
    await page.waitForTimeout(450);
  }
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(600);
  await page.keyboard.press('Shift+Meta+z');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/9-small-leaf.png` });
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(1500);
  const video = page.video();
  await context.close();
  if (video) renameSync(await video.path(), `${OUT}/9-stitching.webm`);
});

test('Stitch tools: hover shows a cross-section card; the crosshair chevrons say in or out', async ({
  page,
}) => {
  await open(page);
  const tools = [
    ['Running stitch', 'running'],
    ['Back stitch', 'back'],
    ['Satin stitch', 'satin'],
    ['French knot', 'knot'],
  ] as const;
  for (const [label, id] of tools) {
    const button = page.getByRole('button', { name: label, exact: true });
    await button.hover();
    const card = page.getByRole('tooltip');
    await expect(card).toBeVisible();
    await expect(card).toContainText(label);
    await expect(button).toHaveAttribute('aria-describedby', 'hoop-stitch-card');
    const b = (await button.boundingBox())!;
    const c = (await card.boundingBox())!;
    expect(Math.abs(c.x + c.width / 2 - (b.x + b.width / 2))).toBeLessThan(2); // centred over its button
    expect(c.y + c.height).toBeLessThan(b.y); // and above it
    await page.waitForTimeout(tuningDiagramMs * 0.85); // thread fully drawn, needle at the end
    const box = (await card.boundingBox())!;
    await page.screenshot({
      path: `${OUT}/diagram-${id}.png`,
      clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 },
    });
  }
  await page.mouse.move(720, 300);
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  // Chevrons: out (needle comes up) to start, in (goes down) to finish a stitch on top, out again
  // after it; a French knot is both.
  await page.keyboard.press('r');
  await zoomTo(page, 3);
  const needle = () => ui(page).getAttribute('data-needle');
  const aimAt = async (x: number, y: number) => {
    const p = await screen(page, x, y);
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(450);
    return p;
  };
  const shot = async (name: string, p: { x: number; y: number }) =>
    page.screenshot({
      path: `${OUT}/chevrons-${name}.png`,
      clip: { x: p.x - 60, y: p.y - 60, width: 120, height: 120 },
    });
  let p = await aimAt(0, 0);
  expect(await needle()).toBe('out');
  await shot('out', p);
  await stitchAt(page, 0, 0);
  p = await aimAt(4, 0);
  expect(await needle()).toBe('in');
  await shot('in', p);
  await stitchAt(page, 4, 0);
  await aimAt(6, 0);
  expect(await needle()).toBe('out');
  await page.keyboard.press('k');
  p = await aimAt(0, 8);
  expect(await needle()).toBe('knot');
  await shot('knot', p);
  await page.keyboard.press('h');
  await page.mouse.move(p.x + 5, p.y);
  expect(await needle()).toBe('none');
});

const tuningDiagramMs = 3600;
