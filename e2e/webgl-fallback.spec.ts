// M0: without WebGL2 the app shows a friendly message instead of a blank canvas.
import { expect, test } from '@playwright/test';

test('shows a friendly message when WebGL2 is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type === 'webgl2') return null;
      return (original as (...a: unknown[]) => RenderingContext | null).call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Hoop needs WebGL2');
  await expect(page.locator('canvas')).toHaveCount(0);
});
