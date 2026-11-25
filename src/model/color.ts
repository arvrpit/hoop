// Colour conversions (pure). HSL is what people edit; shaders want linear sRGB.
import { converter, formatHex } from 'culori';
import type { HSL } from './types';

const toRgb = converter('rgb');
const toLrgb = converter('lrgb');
const toOklch = converter('oklch');

export type RGB = [number, number, number];

/** HSL (0–360, 0–100, 0–100) → gamma-encoded sRGB 0–1. */
export function hslToSrgb(c: HSL): RGB {
  const rgb = toRgb({ mode: 'hsl', h: c.h, s: c.s / 100, l: c.l / 100 });
  return [clamp01(rgb.r), clamp01(rgb.g), clamp01(rgb.b)];
}

/** HSL → linear sRGB 0–1 (what the shaders light with). */
export function hslToLinear(c: HSL): RGB {
  const l = toLrgb({ mode: 'hsl', h: c.h, s: c.s / 100, l: c.l / 100 });
  return [clamp01(l.r), clamp01(l.g), clamp01(l.b)];
}

export function hslToHex(c: HSL): string {
  return formatHex({ mode: 'hsl', h: c.h, s: c.s / 100, l: c.l / 100 });
}

/**
 * Scale perceptual lightness in OKLCH (so every hue shifts evenly), return HSL.
 * `deltaL` is in OKLCH lightness units (0–1 scale), e.g. ±0.03.
 */
export function shiftLightnessOklch(c: HSL, deltaL: number): HSL {
  const ok = toOklch({ mode: 'hsl', h: c.h, s: c.s / 100, l: c.l / 100 });
  const shifted = { ...ok, l: clamp01(ok.l + deltaL) };
  const hsl = converter('hsl')(shifted);
  return {
    h: Number.isFinite(hsl.h) ? (hsl.h as number) : c.h,
    s: clamp01(hsl.s) * 100,
    l: clamp01(hsl.l) * 100,
  };
}

/** 5 swatches from darker to lighter, even steps in OKLCH (spec 8.2 nudge row). */
export function lightnessNudgeRow(c: HSL, step = 0.07): HSL[] {
  return [-2, -1, 0, 1, 2].map((k) => (k === 0 ? c : shiftLightnessOklch(c, k * step)));
}

function clamp01(x: number | undefined): number {
  if (x === undefined || !Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

// ---------------------------------------------------------------------------------------------
// RGB (0–255): what the thread picker edits. Threads still store HSL; these convert both ways.

export type RGB255 = [number, number, number];

export function hslToRgb255(c: HSL): RGB255 {
  const [r, g, b] = hslToSrgb(c);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function rgb255ToHsl([r, g, b]: RGB255): HSL {
  const hsl = toHsl({ mode: 'rgb', r: r / 255, g: g / 255, b: b / 255 });
  return {
    h: Number.isFinite(hsl.h) ? (hsl.h as number) : 0,
    s: clamp01(hsl.s) * 100,
    l: clamp01(hsl.l) * 100,
  };
}

export function rgb255ToHex([r, g, b]: RGB255): string {
  return '#' + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('');
}

/** "#a1b2c3", "a1b2c3" or "#abc" → RGB, or null if it isn't a hex colour. */
export function hexToRgb255(hex: string): RGB255 | null {
  let h = hex.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.replace(/./g, (c) => c + c);
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB255;
}

/** 5 shades from darker to lighter: mixed toward black, the colour itself, mixed toward white. */
export function shadeRow(c: RGB255, step = 0.2): RGB255[] {
  return [-2, -1, 0, 1, 2].map((k) => {
    const t = Math.abs(k) * step;
    const to = k < 0 ? 0 : 255;
    return c.map((v) => (k === 0 ? v : Math.round(v + (to - v) * t))) as RGB255;
  });
}

const toHsl = converter('hsl');
const clamp255 = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
