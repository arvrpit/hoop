// First visit: the "How it works" steps open over the product screen, step through with pictures,
// stay closed after that, and come back from "How it works".
import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'review/m4';
test.use({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  storageState: { cookies: [], origins: [] },
});
test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

test('onboarding: four steps on first visit, then only when asked', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?panel=0');
  const dialog = page.getByRole('dialog', { name: 'Place the hoop' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('How it works · 1 of 4')).toBeVisible();
  const img = dialog.getByRole('img', { name: /tote bag with an embroidery hoop/ });
  await expect(img).toBeVisible();
  await expect
    .poll(() => img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth))
    .toBeGreaterThan(0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/6-onboarding-1.png` });

  // Keyboard shortcuts of the app are off while it's open; Next / arrow keys move through the steps.
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('dialog', { name: 'Sketch your design' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'Stitch it' })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/7-onboarding-3.png` });
  await page.getByRole('button', { name: 'Step 4: See the finished piece' }).click();
  const last = page.getByRole('dialog', { name: 'See the finished piece' });
  await expect(last.getByRole('img', { name: /finished tote bag/ })).toBeVisible();
  await last.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Remembered: not shown again after a reload…
  await page.reload();
  await page.waitForFunction(() => !!window.__hoop);
  await page.waitForTimeout(500);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // …until asked for. Esc closes it.
  await page.getByRole('button', { name: 'How it works' }).click();
  await expect(page.getByRole('dialog', { name: 'Place the hoop' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});
