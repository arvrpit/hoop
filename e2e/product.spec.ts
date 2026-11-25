// Product-first flow, end to end: pick a product, place the hoop, draw and upload a design guide,
// start stitching, stitch an asymmetric "F" plus a satin block, then go back and check the
// embroidery is baked onto the product. Writes review screenshots to review/product/.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'review/product';
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

type AppLike = {
  screen: string;
  product: string;
  hoopSize: number;
  tool: string;
  modelVersion: number;
  pieceId: string | null;
  unsaved: boolean;
  saveStatus: string;
  placement: Record<string, { panel: string; u: number; v: number }>;
};
const app = (page: Page) =>
  page.evaluate(() => {
    const a = window.__hoop!.app() as AppLike;
    return {
      screen: a.screen,
      product: a.product,
      hoopSize: a.hoopSize,
      tool: a.tool,
      modelVersion: a.modelVersion,
      pieceId: a.pieceId,
      unsaved: a.unsaved,
      saveStatus: a.saveStatus,
      placement: a.placement,
    };
  });
const design = (page: Page) =>
  page.evaluate(() => {
    const d = window.__hoop!.design() as {
      strokes: { points: unknown[] }[];
      image: { x: number; y: number; widthMm: number; rotationDeg: number } | null;
      visible: boolean;
      opacity: number;
    };
    return {
      strokes: d.strokes.map((s) => s.points.length),
      image: d.image && { x: d.image.x, y: d.image.y, widthMm: d.image.widthMm, rot: d.image.rotationDeg },
      visible: d.visible,
      opacity: d.opacity,
    };
  });

async function waitModel(page: Page, after: number) {
  await page.waitForFunction((n) => (window.__hoop!.app() as AppLike).modelVersion > n, after, {
    timeout: 30_000,
  });
  await page.evaluate(() => window.__hoop!.flush(6));
}

async function choose(page: Page, group: string, name: string) {
  await page.getByRole('radiogroup', { name: group }).getByRole('radio', { name, exact: true }).click();
}

/** Back stitch along a list of hoop points (mm). */
async function backStitch(page: Page, pts: [number, number][]) {
  for (const [x, y] of pts) {
    const p = await page.evaluate(
      ([px, py]) => window.__hoopInteraction!.toScreen({ x: px!, y: py! }),
      [x, y],
    );
    await page.mouse.move(p.x, p.y);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(140);
  }
}

async function toScreen(page: Page, screen: string) {
  await page.waitForFunction((s) => (window.__hoop!.app() as AppLike).screen === s, screen, {
    timeout: 15_000,
  });
  if (screen === 'stitch') await page.waitForFunction(() => !!window.__hoopInteraction);
  await page.waitForTimeout(300);
}

/** Save & render from the hoop view, confirm, and wait until it is saved. */
async function saveAndRender(page: Page) {
  await page.getByRole('button', { name: 'Save & render' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Finished stitching?');
  await dialog.getByRole('button', { name: 'Save & render' }).click();
  await page.waitForFunction(
    () => {
      const a = window.__hoop!.app() as AppLike;
      return a.screen === 'finished' && a.saveStatus === 'saved';
    },
    null,
    { timeout: 15_000 },
  );
  await expect(page.getByText('Saved to Your pieces.')).toBeVisible();
  await page.waitForTimeout(300);
}

const line = (a: [number, number], b: [number, number], step = 3): [number, number][] => {
  const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
  return Array.from({ length: n + 1 }, (_, i) => [
    a[0] + ((b[0] - a[0]) * i) / n,
    a[1] + ((b[1] - a[1]) * i) / n,
  ]);
};

test('product-first flow: set up, design, stitch, see it on the product', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.__hoopPlatform = 'mac';
  });
  await page.goto('/?panel=0');
  await page.waitForFunction(() => !!window.__hoop);
  await waitModel(page, 0);

  // T-shirt first, with its credit.
  expect((await app(page)).product).toBe('tshirt');
  await expect(page.getByText(/funlab117/)).toBeVisible();
  await page.screenshot({ path: `${OUT}/1-tshirt.png` });

  // Tote and notebook, each with its own credit. The notebook only takes the 100 mm hoop.
  let v = (await app(page)).modelVersion;
  await choose(page, 'Product', 'Tote bag');
  await waitModel(page, v);
  await expect(page.getByText(/funlab117/)).toHaveCount(0);
  await expect(page.getByText(/MoonOctopus/)).toBeVisible();
  await page.screenshot({ path: `${OUT}/2-tote.png` });
  v = (await app(page)).modelVersion;
  await choose(page, 'Product', 'Notebook');
  await waitModel(page, v);
  const sizes = page.getByRole('radiogroup', { name: 'Hoop size' });
  await expect(sizes.getByRole('radio', { name: '100 mm' })).toBeEnabled();
  await expect(sizes.getByRole('radio', { name: '150 mm' })).toBeDisabled();
  await expect(sizes.getByRole('radio', { name: '200 mm' })).toBeDisabled();
  expect((await app(page)).hoopSize).toBe(100); // the notebook keeps its own hoop size
  await expect(page.getByText(/SCANIMAT/)).toBeVisible();
  await page.screenshot({ path: `${OUT}/3-notebook.png` });

  // Back to the T-shirt; presets move the hoop.
  v = (await app(page)).modelVersion;
  await choose(page, 'Product', 'T-shirt');
  await waitModel(page, v);
  expect((await app(page)).hoopSize).toBe(150); // and the T-shirt gets its 150 mm back
  await choose(page, 'Hoop size', '100 mm');
  await page.getByRole('button', { name: 'Left chest' }).click();
  let pl = (await app(page)).placement.tshirt!;
  expect(pl.u).toBeCloseTo(95, 0);
  await page.screenshot({ path: `${OUT}/4-left-chest.png` });
  await page.getByRole('button', { name: 'Chest centre' }).click();
  await choose(page, 'Hoop size', '150 mm');
  pl = (await app(page)).placement.tshirt!;
  expect(pl.u).toBeCloseTo(0, 0);

  // Face the hoop (Pen), go back to Move, and drag the hoop itself a little to the right.
  await choose(page, 'Design tool', 'Pen');
  await page.waitForTimeout(800);
  await choose(page, 'Design tool', 'Move hoop');
  await page.mouse.move(720, 450);
  await page.mouse.down();
  await page.mouse.move(760, 450, { steps: 6 });
  await page.mouse.up();
  const dragged = (await app(page)).placement.tshirt!;
  console.log(
    `hoop drag: u ${pl.u.toFixed(1)} → ${dragged.u.toFixed(1)}, v ${pl.v.toFixed(1)} → ${dragged.v.toFixed(1)}`,
  );
  expect(Math.abs(dragged.u - pl.u)).toBeGreaterThan(3);
  await page.getByRole('button', { name: 'Chest centre' }).click();

  // Upload a PNG (a blue ring with a notch at the top right so orientation shows).
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.strokeStyle = '#2f6fd6';
    g.lineWidth = 18;
    g.beginPath();
    g.arc(128, 128, 96, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#d63b2f';
    g.fillRect(190, 20, 46, 46);
    return c.toDataURL('image/png').split(',')[1]!;
  });
  await page.locator('input[type=file]').setInputFiles({
    name: 'ring.png',
    mimeType: 'image/png',
    buffer: Buffer.from(b64, 'base64'),
  });
  await page.waitForFunction(() => !!(window.__hoop!.design() as { image: unknown }).image);
  expect((await app(page)).tool).toBe('image');
  await page.waitForTimeout(800);
  // Move it by dragging, then turn it with the keyboard.
  const im0 = (await design(page)).image!;
  await page.mouse.move(720, 450);
  await page.mouse.down();
  await page.mouse.move(690, 430, { steps: 6 });
  await page.mouse.up();
  const im1 = (await design(page)).image!;
  console.log(
    `image drag: x ${im0.x.toFixed(1)} → ${im1.x.toFixed(1)}, y ${im0.y.toFixed(1)} → ${im1.y.toFixed(1)}`,
  );
  expect(Math.hypot(im1.x - im0.x, im1.y - im0.y)).toBeGreaterThan(3);
  await page.getByLabel('Turn').focus();
  for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowRight');
  expect((await design(page)).image!.rot).toBe(15);
  await page.screenshot({ path: `${OUT}/5-image.png` });

  // Pen stroke (a wave across the lower half of the hoop).
  await choose(page, 'Design tool', 'Pen');
  await page.waitForTimeout(800);
  await page.mouse.move(600, 560);
  await page.mouse.down();
  for (let i = 1; i <= 24; i++) await page.mouse.move(600 + i * 10, 560 + Math.sin(i / 3) * 25);
  await page.mouse.up();
  const d = await design(page);
  expect(d.strokes.length).toBe(1);
  expect(d.strokes[0]!).toBeGreaterThan(8);
  await page.screenshot({ path: `${OUT}/6-pen.png` });

  // Start stitching: the hoop view opens on jersey with the guide traced on it.
  await page.getByRole('button', { name: 'Start stitching' }).click();
  await page.waitForFunction(() => (window.__hoop!.app() as AppLike).screen === 'stitch', null, {
    timeout: 10_000,
  });
  await page.waitForFunction(() => !!window.__hoopInteraction);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => (window.__hoop!.get() as { fabric: string }).fabric)).toBe('jersey');
  expect((await design(page)).visible).toBe(true);
  await page.screenshot({ path: `${OUT}/7-hoop-guide.png` });

  // Stitch an "F" in back stitch (asymmetric, so a flipped bake shows), then a satin block.
  await page.evaluate(() => window.__hoop!.set({ zoom: 2 }));
  await page.evaluate(() => window.__hoop!.flush(3));
  await page.keyboard.press('b');
  await backStitch(page, line([-10, -22], [-10, 22]));
  await backStitch(page, line([-10, 22], [12, 22]).slice(1));
  await page.keyboard.press('t');
  await backStitch(page, line([-10, 2], [6, 2]));
  await page.keyboard.press('t');
  await page.keyboard.press('s');
  const satin: [number, number][] = [];
  for (let x = 4; x <= 20; x += 1.4) satin.push([x, -10], [x, -22]);
  await backStitch(page, satin);
  await page.keyboard.press('t');
  await page.waitForTimeout(600);
  const front = await page.evaluate(() => window.__hoop!.state().front);
  console.log(`stitched ${front} front stitches`);
  expect(front).toBeGreaterThan(20);
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/8-hoop-stitched.png` });

  // ← Product: the embroidery is baked onto the shirt.
  await page.getByRole('button', { name: /T-shirt/ }).click();
  await page.waitForFunction(() => (window.__hoop!.app() as AppLike).screen === 'product', null, {
    timeout: 10_000,
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__hoop!.flush(6));
  await page.screenshot({ path: `${OUT}/9-product-embroidered.png` });
  await choose(page, 'Design tool', 'Pen');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/10-product-closeup.png` });

  // One piece at a time: switching product with unsaved stitches asks first; Go back keeps it.
  await choose(page, 'Product', 'Tote bag');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Discard unsaved stitches?');
  await page.screenshot({ path: `${OUT}/11-switch-asks.png` });
  await dialog.getByRole('button', { name: 'Go back' }).click();
  expect((await app(page)).product).toBe('tshirt');

  // Save & render from the hoop view: confirm, then the finished piece (no hoop, no guide), saved.
  await page.getByRole('button', { name: 'Continue stitching' }).click();
  await toScreen(page, 'stitch');
  await saveAndRender(page);
  await page.screenshot({ path: `${OUT}/12-finished.png` });
  const first = await app(page);
  expect(first.pieceId).toBeTruthy();
  expect(first.unsaved).toBe(false);

  // Download image gives a PNG of the finished piece.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download image' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^hoop-t-shirt.*\.png$/);
  await download.saveAs(`${OUT}/13-download.png`);

  // Keep stitching puts it back in the hoop; saving again updates the same piece.
  await page.getByRole('button', { name: 'Keep stitching' }).click();
  await toScreen(page, 'stitch');
  await page.evaluate(() => window.__hoop!.set({ zoom: 2 }));
  await page.keyboard.press('b');
  await backStitch(page, line([-24, -30], [24, -30]));
  await page.keyboard.press('t');
  expect((await app(page)).unsaved).toBe(true);
  await saveAndRender(page);
  expect((await app(page)).pieceId).toBe(first.pieceId);
  await page.screenshot({ path: `${OUT}/14-finished-again.png` });

  // New piece: a blank product screen with the saved piece on the shelf; switching is free again.
  await page.getByRole('button', { name: 'New piece' }).click();
  await toScreen(page, 'product');
  const shelf = page.getByRole('region', { name: 'Your pieces' });
  await expect(shelf.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Start stitching' })).toBeVisible();
  v = (await app(page)).modelVersion;
  await choose(page, 'Product', 'Tote bag');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await waitModel(page, v);
  await page.screenshot({ path: `${OUT}/15-new-piece-shelf.png` });

  // Open the saved piece from the shelf: the finished T-shirt again.
  await shelf.getByRole('button', { name: /^Open / }).click();
  await toScreen(page, 'finished');
  expect((await app(page)).product).toBe('tshirt');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/16-reopened.png` });

  // Still there after a reload (kept in this browser).
  await page.reload();
  await page.waitForFunction(() => !!window.__hoop);
  await expect(page.getByRole('region', { name: 'Your pieces' }).getByRole('listitem')).toHaveCount(1);

  expect(errors).toEqual([]);
});
