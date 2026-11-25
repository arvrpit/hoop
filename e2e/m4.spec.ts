// M4 reference scenario (SPEC §11): a tree on a tote bag. Brown back-stitch trunk, green satin
// leaves, back to brown to carry the branch on from its last hole, then red French knots for fruit.
// Also checks the thread rack, picker, eyedropper, edit/undo and remove, and saves review
// screenshots to review/m4/. With ONBOARDING_SHOTS=1 it also writes the onboarding pictures to
// public/onboarding/.
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'review/m4';
const SHOTS = process.env.ONBOARDING_SHOTS === '1' ? 'public/onboarding' : null;
test.use({ viewport: { width: 1200, height: 750 }, deviceScaleFactor: 1 });
test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
});

type Pt = [number, number];
const K = 1.3; // the tree is drawn in these units × K mm, so it fills most of the 150 mm hoop
const state = (page: Page) => page.evaluate(() => window.__hoop!.state());
const appScreen = (page: Page) => page.evaluate(() => (window.__hoop!.app() as { screen: string }).screen);

async function waitModel(page: Page, after: number) {
  await page.waitForFunction(
    (n) => (window.__hoop!.app() as { modelVersion: number }).modelVersion > n,
    after,
    { timeout: 30_000 },
  );
  await page.evaluate(() => window.__hoop!.flush(6));
}

async function screenAt(page: Page, [x, y]: Pt) {
  return page.evaluate(([px, py]) => window.__hoopInteraction!.toScreen({ x: px!, y: py! }), [x * K, y * K]);
}

async function clickHoop(page: Page, pts: Pt[], wait = 110) {
  for (const pt of pts) {
    const p = await screenAt(page, pt);
    await page.mouse.move(p.x, p.y);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(wait);
  }
}

const line = (a: Pt, b: Pt, step = 3): Pt[] => {
  const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
  return Array.from({ length: n + 1 }, (_, i) => [
    a[0] + ((b[0] - a[0]) * i) / n,
    a[1] + ((b[1] - a[1]) * i) / n,
  ]);
};

/** Satin rows across a leaf: centre, length along its axis, widest width, axis angle (deg). */
function leaf(c: Pt, len: number, width: number, deg: number, gap = 2 / 1.4 / K): Pt[] {
  const a = (deg * Math.PI) / 180;
  const ax: Pt = [Math.cos(a), Math.sin(a)];
  const nx: Pt = [-ax[1], ax[0]];
  const out: Pt[] = [];
  for (let t = -len / 2 + gap; t <= len / 2 - gap / 2; t += gap) {
    const w = (width / 2) * Math.sqrt(Math.max(0, 1 - ((2 * t) / len) ** 2));
    if (w < 0.8) continue;
    const m: Pt = [c[0] + ax[0] * t, c[1] + ax[1] * t];
    out.push([m[0] + nx[0] * w, m[1] + nx[1] * w], [m[0] - nx[0] * w, m[1] - nx[1] * w]);
  }
  return out;
}

const leaves: [Pt, number, number, number][] = [
  [[-15, 14], 15, 7, 150],
  [[14, 20], 14, 6.5, 35],
  [[-2, 29], 15, 7, 95],
  [[-24, 24], 11, 5, 120],
  [[24, 8], 11, 5, 20],
];
const fruit: Pt[] = [
  [-6, 20],
  [7, 30],
  [19, 13],
  [-20, 7],
  [3, 13],
  [-12, 31],
];

/** The sketch traced on the tote: trunk, branches, a cloud of canopy and the leaves. */
function sketch() {
  const stroke = (points: Pt[]) => ({
    points: points.map(([x, y]) => ({ x: x * K, y: y * K })),
    widthMm: 1,
    erase: false,
  });
  const canopy: Pt[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const r = 30 + 2.5 * Math.sin(a * 7);
    canopy.push([r * Math.cos(a), 17 + r * 0.82 * Math.sin(a)]);
  }
  const leafOutline = ([c, len, width, deg]: (typeof leaves)[number]): Pt[] => {
    const a = (deg * Math.PI) / 180;
    const pts: Pt[] = [];
    for (let i = 0; i <= 24; i++) {
      const s = (i / 24) * Math.PI * 2;
      const u = (len / 2) * Math.cos(s);
      const v = (width / 2) * Math.sin(s) * Math.abs(Math.sin(s)) ** 0.2;
      pts.push([c[0] + u * Math.cos(a) - v * Math.sin(a), c[1] + u * Math.sin(a) + v * Math.cos(a)]);
    }
    return pts;
  };
  return [
    stroke([
      [0, -44],
      [0, 0],
    ]),
    stroke([
      [0, 0],
      [8, 8],
      [16, 15],
    ]),
    stroke([
      [0, -12],
      [-12, 2],
    ]),
    stroke(canopy),
    ...leaves.map((l) => stroke(leafOutline(l))),
  ];
}

/** Screenshot without any interface (for the onboarding pictures). */
async function cleanShot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.evaluate(() => window.__hoop!.set({ hideUi: true }));
  await page.evaluate(() => window.__hoop!.flush(6));
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/${name}.jpg`, type: 'jpeg', quality: 82 });
  await page.evaluate(() => window.__hoop!.set({ hideUi: false }));
  await page.evaluate(() => window.__hoop!.flush(2));
}

/** Open a thread's ⋯ menu: hover its skein (that shows ⋯), then click ⋯. */
async function threadMenu(page: Page, name: string) {
  await openRack(page);
  await page
    .getByRole('toolbar', { name: 'Threads' })
    .getByRole('button', { name: new RegExp(`^${name} \\(`) })
    .hover();
  await page.getByRole('button', { name: `More for ${name}` }).click();
}

/** Slide the thread drawer out by hovering the left edge. */
async function openRack(page: Page) {
  await page.mouse.move(6, 375);
  await page.waitForFunction(() => document.querySelector('.hoop-rack')?.hasAttribute('data-open'));
  await page.waitForTimeout(260); // the slide
}

async function addThread(page: Page, colour: string, strands = 2) {
  await openRack(page);
  await page.getByRole('button', { name: 'Add a thread' }).click();
  const picker = page.getByRole('dialog', { name: 'New thread' });
  await expect(picker).toBeVisible();
  await picker.getByRole('radio', { name: colour, exact: true }).click();
  await expect(picker.getByLabel('Name')).toHaveValue(colour);
  const slider = picker.getByRole('slider', { name: 'Strands' });
  await slider.focus();
  for (let i = 2; i < strands; i++) await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue(String(strands));
  await picker.getByRole('button', { name: 'Thread needle' }).click();
  await expect(picker).toHaveCount(0);
}

test('reference tree: threads, rack, picker, eyedropper, on a tote bag', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.__hoopPlatform = 'mac';
  });
  await page.goto('/?panel=0');
  await page.waitForFunction(() => !!window.__hoop);
  await waitModel(page, 0);

  // Tote bag, 150 mm hoop on the front.
  const v = await page.evaluate(() => (window.__hoop!.app() as { modelVersion: number }).modelVersion);
  await page.getByRole('radiogroup', { name: 'Product' }).getByRole('radio', { name: 'Tote bag' }).click();
  await waitModel(page, v);
  await page.waitForTimeout(500);
  await cleanShot(page, '1-place');

  // Sketch the tree (as pen strokes), facing the hoop.
  await page.getByRole('radiogroup', { name: 'Design tool' }).getByRole('radio', { name: 'Pen' }).click();
  await page.evaluate((strokes) => window.__hoop!.design({ strokes }), sketch());
  await page.waitForTimeout(900);
  await cleanShot(page, '2-sketch');

  // Into the hoop.
  await page.getByRole('button', { name: 'Start stitching' }).click();
  await page.waitForFunction(() => !!window.__hoopInteraction);
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__hoop!.set({ zoom: 1.3, focus: { x: 0, y: -2 } }));
  await page.evaluate(() => window.__hoop!.flush(3));
  await expect(
    page.getByRole('toolbar', { name: 'Threads' }).getByRole('button', { name: 'Bark brown (1)' }),
  ).toHaveAttribute('aria-pressed', 'true');

  // 1. Brown back-stitch trunk and the start of the right branch; leave the line open.
  await page.keyboard.press('b');
  await clickHoop(page, [...line([0, -44], [0, 0]), ...line([0, 0], [8, 8]).slice(1)]);
  let s = await state(page);
  expect(s.thread).toBe('Bark brown');
  const branchEnd = s.needle!;
  expect(Math.hypot(branchEnd.x - 8 * K, branchEnd.y - 8 * K)).toBeLessThan(1);

  // 2. Green satin leaves (a new thread from the picker's colour card).
  await addThread(page, 'Leaf green', 5); // thick, so the satin rows lie edge to edge
  s = await state(page);
  expect(s.thread).toBe('Leaf green');
  expect(s.needle).toBeNull(); // a fresh thread starts a new line
  await page.keyboard.press('s');
  for (const l of leaves) {
    await clickHoop(page, leaf(...l), 70);
    await page.keyboard.press('t');
  }
  await page.screenshot({ path: `${OUT}/1-leaves.png` });

  // 3. Back to brown (key 1): back stitch again, picking up from the branch's last hole.
  await page.keyboard.press('1');
  s = await state(page);
  expect(s.thread).toBe('Bark brown');
  expect(s.stitchType).toBe('back');
  expect(s.needle).toEqual(branchEnd);
  const p = await screenAt(page, [16, 15]);
  await page.mouse.move(p.x, p.y);
  await page.screenshot({ path: `${OUT}/2-resume-brown.png` });
  await clickHoop(page, line([8, 8], [16, 15]).slice(1));
  await page.keyboard.press('t');
  await clickHoop(page, line([0, -12], [-12, 2]));
  await page.keyboard.press('t');

  // 4. Red French knots for fruit.
  await addThread(page, 'Cherry red', 3);
  await page.keyboard.press('k');
  await clickHoop(page, fruit, 260);
  s = await state(page);
  expect(s.knots).toBe(fruit.length);
  expect(s.threads.map((t) => t.name)).toEqual(['Bark brown', 'Leaf green', 'Cherry red']);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/3-tree.png` });

  // The thread drawer: tucked away with only the thread on the needle peeking out at the left edge;
  // hovering the edge slides it out, with the thread on the needle sitting out of line.
  const drawer = page.locator('.hoop-rack');
  const box = async (name: string) => (await page.getByRole('button', { name }).boundingBox())!;
  await page.mouse.move(700, 375);
  await expect(drawer).not.toHaveAttribute('data-open');
  await page.waitForTimeout(300);
  const peek = await box('Cherry red (3)');
  expect(peek.x).toBeLessThan(0);
  expect(peek.x + peek.width).toBeGreaterThan(12);
  const hidden = page.locator('.hoop-rack li:not([data-active])').first();
  expect(await hidden.evaluate((e) => getComputedStyle(e).opacity)).toBe('0');
  await page.screenshot({
    path: `${OUT}/3a-rack-closed.png`,
    clip: { x: 0, y: 200, width: 300, height: 350 },
  });
  await openRack(page);
  const [on, off] = [await box('Cherry red (3)'), await box('Leaf green (2)')];
  expect(on.x - off.x).toBeGreaterThan(12);
  expect(off.x).toBeGreaterThan(16);
  await page.getByRole('button', { name: 'Leaf green (2)' }).hover();
  await page.screenshot({ path: `${OUT}/3b-rack-open.png`, clip: { x: 0, y: 200, width: 300, height: 350 } });
  await page.mouse.move(700, 375);
  await expect(drawer).not.toHaveAttribute('data-open');

  // Eyedropper: Option+click a leaf picks up green; press and hold on the trunk picks up brown.
  const onLeaf = await screenAt(page, leaves[0]![0]);
  await page.keyboard.down('Alt');
  await page.mouse.move(onLeaf.x, onLeaf.y);
  await page.mouse.click(onLeaf.x, onLeaf.y);
  await page.keyboard.up('Alt');
  s = await state(page);
  expect(s.thread).toBe('Leaf green');
  await expect(page.locator('.hoop-toast')).toContainText('Picked up Leaf green');
  const before = s.punctures;
  const onTrunk = await screenAt(page, [0, -30]);
  await page.mouse.move(onTrunk.x, onTrunk.y);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  s = await state(page);
  expect(s.thread).toBe('Bark brown');
  expect(s.punctures).toBe(before); // holding doesn't stitch

  // Edit green from the rack menu: Moss recolours its leaves; undo brings Leaf green back.
  await threadMenu(page, 'Leaf green');
  await page.getByRole('menuitem', { name: 'Edit thread…' }).click();
  const picker = page.getByRole('dialog', { name: 'Edit thread' });
  await expect(picker).toContainText(/Recolours the \d+ stitches/);
  await picker.getByRole('radio', { name: 'Moss', exact: true }).click();
  await expect(picker.getByLabel('Hex colour')).toHaveValue('#7d8a3c');
  await picker.getByRole('button', { name: 'Save' }).click();
  s = await state(page);
  expect(s.threads[1]).toMatchObject({ name: 'Moss', hex: '#7d8a3c' });
  await page.keyboard.press('Meta+z');
  s = await state(page);
  expect(s.threads[1]).toMatchObject({ name: 'Leaf green', hex: '#4f7a3a' });

  // Shades: picking one selects that swatch; the row stays made from the base colour (it doesn't
  // shift lighter), and the colour card keeps showing the colour it came from.
  await page.getByRole('button', { name: /^Edit thread: / }).click();
  const edit = page.getByRole('dialog', { name: 'Edit thread' });
  const shadeRow = edit.getByRole('radiogroup', { name: 'Shades' });
  const shadeSwatch = (name: string) => shadeRow.getByRole('radio', { name, exact: true });
  const rowColours = () =>
    shadeRow.getByRole('radio').evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
  const row0 = await rowColours();
  await expect(shadeSwatch('Base colour')).toHaveAttribute('aria-checked', 'true');
  await shadeSwatch('Lighter').click();
  await expect(shadeSwatch('Lighter')).toHaveAttribute('aria-checked', 'true');
  await expect(shadeSwatch('Base colour')).toHaveAttribute('aria-checked', 'false');
  await expect(edit.getByLabel('Hex colour')).toHaveValue('#8c6c55');
  await expect(edit.getByLabel('Name')).toHaveValue('Light bark brown');
  expect(await rowColours()).toEqual(row0);
  await expect(edit.getByRole('radio', { name: 'Bark brown', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await shadeSwatch('Much lighter').click();
  await expect(edit.getByLabel('Hex colour')).toHaveValue('#a9917f');
  expect(await rowColours()).toEqual(row0);
  await page.screenshot({ path: `${OUT}/4a-picker-shade.png` });

  await shadeSwatch('Base colour').click();
  await expect(edit.getByLabel('Hex colour')).toHaveValue('#6f472a');
  await expect(edit.getByLabel('Name')).toHaveValue('Bark brown');

  // RGB edits and the hex box agree; Cancel leaves the thread alone.
  await edit.getByLabel('Red value').fill('200');
  await expect(edit.getByLabel('Hex colour')).toHaveValue('#c8472a');
  await page.screenshot({ path: `${OUT}/4-picker-edit.png` });
  await edit.getByRole('button', { name: 'Cancel' }).click();
  expect((await state(page)).threads[0]).toMatchObject({ name: 'Bark brown', hex: '#6f472a' });

  // Rename from the menu.
  await threadMenu(page, 'Cherry red');
  await page.getByRole('menuitem', { name: 'Rename…' }).click();
  await page.getByLabel('Thread name').fill('Apples');
  await page.keyboard.press('Enter');
  expect((await state(page)).threads[2]!.name).toBe('Apples');

  // Remove asks first ("This will unpick 6 stitches"); Go back keeps it.
  await threadMenu(page, 'Apples');
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  const confirm = page.getByRole('dialog', { name: 'Remove Apples?' });
  await expect(confirm).toContainText(`This will unpick ${fruit.length} stitches`);
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  expect((await state(page)).knots).toBe(fruit.length);

  // The finished hoop and the finished tote.
  await page.evaluate(() => window.__hoop!.set({ zoom: 1.3, focus: { x: 0, y: -2 } }));
  await page.keyboard.press('h'); // View tool: no crosshair in the picture
  await page.waitForTimeout(400);
  await cleanShot(page, '3-stitch');
  await page.getByRole('button', { name: 'Save & render' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save & render' }).click();
  await page.waitForFunction(
    () => {
      const a = window.__hoop!.app() as { screen: string; saveStatus: string };
      return a.screen === 'finished' && a.saveStatus === 'saved';
    },
    null,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(800);
  expect(await appScreen(page)).toBe('finished');
  await page.screenshot({ path: `${OUT}/5-finished.png` });
  await page.evaluate(() => window.__hoopProduct!.faceHoop(2.1));
  await page.waitForTimeout(900);
  await cleanShot(page, '4-finished');

  expect(errors).toEqual([]);
});
