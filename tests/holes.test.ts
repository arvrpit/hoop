import { describe, expect, it } from 'vitest';
import { HoleIndex, holeAt, holeSpacing, snapPoint, validRadius } from '../src/model/holes';
import { mulberry32 } from '../src/model/random';
import type { FabricId } from '../src/model/types';
import { fabrics } from '../src/tuning';

const ctx = (fabric: FabricId, used: [number, number][] = []) => {
  const holes = new HoleIndex();
  for (const [i, j] of used) holes.add(holeAt(i, j, holeSpacing(fabric)).key);
  return { fabric, hoopDiameterMm: 150, holes };
};

describe('holes are the gaps in the weave', () => {
  it('uses every gap between yarns on cotton and linen, the block-corner holes on Aida, 0.3 mm on felt', () => {
    expect(holeSpacing('cotton')).toBeCloseTo(0.45, 9);
    expect(holeSpacing('linen')).toBeCloseTo(0.625, 9);
    expect(holeSpacing('aida14')).toBeCloseTo(25.4 / 14, 9);
    expect(holeSpacing('felt')).toBeCloseTo(0.3, 9);
  });

  it('lines the stitch holes up with the gaps the fabric shader draws', () => {
    // Plain weave: yarn boundaries (gaps) sit at multiples of 1 / threadsPerMm, from the hoop centre.
    for (const f of ['cotton', 'linen'] as const) {
      expect(fabrics[f].holeSpacingMm * fabrics[f].threadsPerMm).toBeCloseTo(1, 9);
    }
    // Aida: holes at the block corners, multiples of the block size; 4 threads per block.
    expect(fabrics.aida14.holeSpacingMm * fabrics.aida14.threadsPerMm).toBeCloseTo(4, 9);
  });

  it.each(['cotton', 'linen', 'aida14', 'felt'] as const)(
    'on %s every snap lands exactly on a hole',
    (fabric) => {
      const s = holeSpacing(fabric);
      const rnd = mulberry32(7);
      for (let n = 0; n < 500; n++) {
        const p = { x: (rnd() - 0.5) * 120, y: (rnd() - 0.5) * 120 };
        const r = snapPoint(p, ctx(fabric));
        if (r.kind === 'invalid') continue;
        expect(Math.abs(r.hole.pos.x / s - Math.round(r.hole.pos.x / s))).toBeLessThan(1e-6);
        expect(Math.abs(r.hole.pos.y / s - Math.round(r.hole.pos.y / s))).toBeLessThan(1e-6);
        expect(r.distMm).toBeLessThanOrEqual(s * Math.SQRT1_2 + 1e-9);
      }
    },
  );
});

describe('snapping priority', () => {
  it('pulls towards a used hole when the pointer is between it and a free one', () => {
    const r = snapPoint({ x: 0.5 * 0.45, y: 0.1 }, ctx('cotton', [[0, 0]]));
    expect(r.kind).toBe('existing');
    expect(r.hole.key).toBe('0,0');
  });

  it('still lets you pick the free hole right next to a used one (satin needs it)', () => {
    const r = snapPoint({ x: 0.45, y: 0 }, ctx('cotton', [[0, 0]]));
    expect(r.kind).toBe('lattice');
    expect(r.hole.key).toBe('1,0');
  });

  it('ignores used holes beyond the magnet radius', () => {
    const r = snapPoint({ x: 3 * 0.45, y: 0 }, ctx('cotton', [[0, 0]]));
    expect(r.hole.key).toBe('3,0');
  });

  it('rejects points outside the hoop (inner radius minus 3 mm)', () => {
    expect(validRadius(150)).toBe(72);
    expect(snapPoint({ x: 73, y: 0 }, ctx('cotton')).kind).toBe('invalid');
    expect(snapPoint({ x: 0, y: -71.5 }, ctx('cotton')).kind).toBe('lattice');
  });

  it('quantises felt to 0.3 mm', () => {
    const r = snapPoint({ x: 1.04, y: -0.44 }, ctx('felt'));
    expect(r.hole.pos).toEqual({ x: 0.9, y: -0.3 });
  });
});
