import { tuning } from '../../tuning';

/** CSS pixels per mm at 1× zoom: the whole hoop (with its ring) fits the viewport with a margin. */
export function fitPxPerMm(widthPx: number, heightPx: number, hoopDiameterMm: number): number {
  const outer = hoopDiameterMm + 2 * tuning.hoopRingWidthMm;
  return Math.min(widthPx, heightPx) / (outer * tuning.overviewMargin);
}
