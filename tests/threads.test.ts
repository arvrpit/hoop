// M4: the thread picker's RGB maths, colour names, and the eyedropper's hit test.
import { describe, expect, it } from 'vitest';
import { hexToRgb255, hslToRgb255, rgb255ToHex, rgb255ToHsl, shadeRow } from '../src/model/color';
import { distToSegment, threadUnder } from '../src/model/eyedropper';
import { colorName, flossCard, uniqueName } from '../src/model/threadColors';
import type { Knot, Stitch } from '../src/model/types';
import { threadMaterials } from '../src/tuning';
import { brown, green, red } from './helpers';

describe('RGB thread colours', () => {
  it('round-trips RGB through the stored HSL exactly', () => {
    for (const hex of ['#000000', '#ffffff', '#4f7a3a', '#c8472a', '#7fb0d8', '#808080', '#123456']) {
      const rgb = hexToRgb255(hex)!;
      expect(rgb255ToHex(hslToRgb255(rgb255ToHsl(rgb)))).toBe(hex);
    }
  });

  it('reads hex with or without #, short or long, and refuses anything else', () => {
    expect(hexToRgb255('#c8472a')).toEqual([200, 71, 42]);
    expect(hexToRgb255('C8472A')).toEqual([200, 71, 42]);
    expect(hexToRgb255('#fa0')).toEqual([255, 170, 0]);
    expect(hexToRgb255('#c8472')).toBeNull();
    expect(hexToRgb255('green')).toBeNull();
  });

  it('makes 5 shades from darker to lighter with the colour in the middle', () => {
    const c = hexToRgb255('#4f7a3a')!;
    const row = shadeRow(c);
    expect(row).toHaveLength(5);
    expect(row[2]).toEqual(c);
    const sum = (x: number[]) => x.reduce((a, b) => a + b, 0);
    for (let i = 1; i < 5; i++) expect(sum(row[i]!)).toBeGreaterThan(sum(row[i - 1]!));
    expect(row[0]!.every((v, i) => v <= c[i]!)).toBe(true); // darker: toward black
    expect(row[4]!.every((v, i) => v >= c[i]!)).toBe(true); // lighter: toward white
  });
});

describe('colour names', () => {
  it('names each colour-card colour after itself', () => {
    for (const c of flossCard) expect(colorName(hexToRgb255(c.hex)!)).toBe(c.name);
  });

  it('picks the nearest plain name for other colours', () => {
    expect(colorName([250, 250, 250])).toBe('White');
    expect(colorName([20, 30, 110])).toMatch(/Navy|Indigo|Cobalt/);
    expect(colorName([200, 71, 42])).toMatch(/Rust|Terracotta|Cherry red/);
  });

  it('numbers a name that a thread already has', () => {
    expect(uniqueName('Leaf green', ['Bark brown'])).toBe('Leaf green');
    expect(uniqueName('Leaf green', ['leaf green'])).toBe('Leaf green 2');
    expect(uniqueName('Leaf green', ['Leaf green', 'Leaf green 2'])).toBe('Leaf green 3');
  });
});

describe('eyedropper', () => {
  const st = (threadId: string, a: [number, number], b: [number, number], order: number): Stitch => ({
    runId: 'r',
    threadId,
    a: { x: a[0], y: a[1] },
    b: { x: b[0], y: b[1] },
    side: 'front',
    seed: 0.5,
    order,
  });
  const threads = [brown, green, red];
  const stitches = [st('brown', [0, 0], [10, 0], 1), st('green', [5, -5], [5, 5], 2)];
  const knots: Knot[] = [{ runId: 'k', threadId: 'red', pos: { x: 20, y: 0 }, seed: 0.1, order: 0 }];
  const at = (x: number, y: number, reach = 0) =>
    threadUnder({ x, y }, stitches, knots, threads, threadMaterials, reach)?.name ?? null;

  it('measures distance to a stitch, not to its line', () => {
    expect(distToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3);
    expect(distToSegment({ x: 13, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(5);
  });

  it('finds a stitch within half its width', () => {
    const half = (threadMaterials.floss.widthPerStrandMm * brown.strands) / 2; // 0.3 mm
    expect(at(2, half * 0.9)).toBe('Bark brown');
    expect(at(2, half * 1.2)).toBeNull();
    expect(at(2, 0.8, 1)).toBe('Bark brown'); // with a little reach
  });

  it('prefers the topmost: the later stitch where two cross, and knots over stitches', () => {
    expect(at(5, 0)).toBe('Leaf green');
    expect(at(20.5, 0)).toBe('Berry red');
    expect(at(30, 0)).toBeNull();
  });

  it('ignores the back of the work', () => {
    const back = { ...st('brown', [40, 0], [50, 0], 3), side: 'back' as const };
    expect(threadUnder({ x: 45, y: 0 }, [back], [], threads, threadMaterials)).toBeNull();
  });
});
