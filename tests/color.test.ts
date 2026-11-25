import { describe, expect, it } from 'vitest';
import { hslToLinear, hslToSrgb, lightnessNudgeRow, shiftLightnessOklch } from '../src/model/color';
import { converter } from 'culori';

const oklch = converter('oklch');
const okL = (h: { h: number; s: number; l: number }) =>
  oklch({ mode: 'hsl', h: h.h, s: h.s / 100, l: h.l / 100 }).l;

describe('colour conversion', () => {
  it('converts HSL to sRGB and linear sRGB', () => {
    expect(hslToSrgb({ h: 0, s: 100, l: 50 })).toEqual([1, 0, 0]);
    const lin = hslToLinear({ h: 0, s: 0, l: 50 });
    // sRGB 0.5 is about 0.214 in linear light
    lin.forEach((c) => expect(c).toBeCloseTo(0.214, 2));
  });

  it('shifts lightness evenly in OKLCH and keeps hue', () => {
    const base = { h: 220, s: 60, l: 45 };
    const lighter = shiftLightnessOklch(base, 0.05);
    expect(okL(lighter) - okL(base)).toBeCloseTo(0.05, 2);
    expect(Math.abs(lighter.h - base.h)).toBeLessThan(6);
  });

  it('builds a 5-step nudge row from darker to lighter around the colour', () => {
    const base = { h: 8, s: 60, l: 44 };
    const row = lightnessNudgeRow(base);
    expect(row).toHaveLength(5);
    expect(row[2]).toEqual(base);
    const ls = row.map(okL);
    for (let i = 1; i < ls.length; i++) expect(ls[i]!).toBeGreaterThan(ls[i - 1]!);
  });
});
