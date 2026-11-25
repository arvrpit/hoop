import { describe, expect, it } from 'vitest';
import { buildDemoPiece, buildStressPiece } from '../src/model/demoPiece';
import { holeSpacing, validRadius } from '../src/model/holes';
import type { FabricId } from '../src/model/types';

const fabrics: FabricId[] = ['cotton', 'linen', 'aida14', 'felt'];

describe('M1 demo piece (built through the stitch engine)', () => {
  it.each(fabrics)(
    'on %s: every material has satin, back, running and 5 knots, all inside the hoop',
    (fabric) => {
      const demo = buildDemoPiece(fabric);
      const r = validRadius(150);
      for (const t of demo.threads) {
        const types = demo.piece!.runs.filter((run) => run.threadId === t.id).map((run) => run.stitchType);
        expect(types.sort()).toEqual(['back', 'knot', 'running', 'satin']);
        expect(demo.knots.filter((k) => k.threadId === t.id)).toHaveLength(5);
      }
      const pts = [...demo.stitches.flatMap((s) => [s.a, s.b]), ...demo.knots.map((k) => k.pos)];
      for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeLessThan(r);
    },
  );

  it.each(fabrics)('on %s: holes sit on the fabric lattice', (fabric) => {
    const s = holeSpacing(fabric);
    for (const st of buildDemoPiece(fabric).stitches) {
      for (const p of [st.a, st.b]) {
        expect(Math.abs(p.x / s - Math.round(p.x / s))).toBeLessThan(1e-4);
        expect(Math.abs(p.y / s - Math.round(p.y / s))).toBeLessThan(1e-4);
      }
    }
  });

  it.each(fabrics)('on %s: satin blocks have one stitch per hole (no doubled stitches)', (fabric) => {
    const demo = buildDemoPiece(fabric);
    for (const run of demo.piece!.runs.filter((r) => r.stitchType === 'satin')) {
      const fr = demo.stitches.filter((s) => s.runId === run.id && s.side === 'front');
      expect(new Set(fr.map((s) => `${s.a.x},${s.a.y}`)).size).toBe(fr.length);
    }
  });

  it('lists visible stitches and knots in creation order, one click each', () => {
    const demo = buildDemoPiece('cotton');
    const visible = [
      ...demo.stitches.filter((s) => s.side === 'front').map((s) => s.order),
      ...demo.knots.map((k) => k.order),
    ];
    expect(new Set(visible).size).toBe(visible.length);
    const all = demo.stitches.map((s) => s.order);
    expect([...all].sort((a, b) => a - b)).toEqual(all);
  });

  it('builds the 20k stress piece deterministically', () => {
    const a = buildStressPiece(20000);
    const b = buildStressPiece(20000);
    expect(a.stitches).toHaveLength(20000);
    expect(a.stitches[123]).toEqual(b.stitches[123]);
  });
});
