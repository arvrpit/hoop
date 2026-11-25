import { createPiece } from '../src/model/piece';
import { StitchEngine } from '../src/model/stitchEngine';
import type { FabricId, Stitch, Thread, Vec2 } from '../src/model/types';

export const brown: Thread = {
  id: 'brown',
  name: 'Bark brown',
  color: { h: 25, s: 45, l: 28 },
  material: 'floss',
  strands: 2,
};
export const green: Thread = {
  id: 'green',
  name: 'Leaf green',
  color: { h: 110, s: 40, l: 35 },
  material: 'floss',
  strands: 3,
};
export const red: Thread = {
  id: 'red',
  name: 'Berry red',
  color: { h: 2, s: 70, l: 42 },
  material: 'perle',
  strands: 1,
};

export function engineFor(
  fabric: FabricId = 'cotton',
  threads: Thread[] = [brown, green, red],
): StitchEngine {
  return new StitchEngine(createPiece({ id: 'test', now: '2026-01-01T00:00:00.000Z', fabric, threads }));
}

/** Hole (i, j) on the fabric's lattice, in mm. */
export const at = (i: number, j: number, s = 0.45): Vec2 => ({ x: i * s, y: j * s });

export const seg = (s: Stitch) => [s.a, s.b];
export const front = (e: StitchEngine) => e.stitches.filter((s) => s.side === 'front');
export const back = (e: StitchEngine) => e.stitches.filter((s) => s.side === 'back');

/** Everything that defines the engine's state, for round-trip comparisons. */
export function snapshot(e: StitchEngine) {
  return JSON.stringify({ piece: e.piece, type: e.activeStitchType, stitches: e.stitches, knots: e.knots });
}
