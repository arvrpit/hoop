// Hard-coded M1 look-test piece: for each thread material a satin block, a back-stitch curve,
// a running-stitch line and 5 French knots. Quadrants: floss top-left, perle top-right,
// silk bottom-left, wool bottom-right. The four satin blocks meet at the hoop centre so a
// close-up there shows all four materials side by side.

import { mulberry32 } from './random';
import { holeSpacing } from './holes';
import { createPiece } from './piece';
import { StitchEngine } from './stitchEngine';
import type { FabricId, Knot, Piece, Stitch, Thread, ThreadMaterial, Vec2 } from './types';

export const demoThreads: Thread[] = [
  { id: 't-floss', name: 'Brick red', color: { h: 8, s: 60, l: 44 }, material: 'floss', strands: 2 },
  { id: 't-perle', name: 'Indigo', color: { h: 222, s: 50, l: 38 }, material: 'perle', strands: 2 },
  { id: 't-silk', name: 'Jade', color: { h: 158, s: 50, l: 34 }, material: 'silk', strands: 2 },
  { id: 't-wool', name: 'Mustard', color: { h: 40, s: 72, l: 48 }, material: 'wool', strands: 2 },
];

const quadrants: Record<ThreadMaterial, { sx: number; sy: number }> = {
  floss: { sx: -1, sy: 1 },
  perle: { sx: 1, sy: 1 },
  silk: { sx: -1, sy: -1 },
  wool: { sx: 1, sy: -1 },
};

export interface DemoPiece {
  threads: Thread[];
  stitches: Stitch[];
  knots: Knot[];
  piece?: Piece;
}

/** Satin step: lattice steps adding up to roughly one thread width (felt has free placement). */
function satinStep(fabric: FabricId): number {
  const s = holeSpacing(fabric);
  return Math.max(1, Math.round(0.9 / s)) * s;
}

/**
 * Built by clicking through the real stitch engine, exactly as a person would: each element is a
 * click sequence, and every puncture snaps to a hole in the weave.
 */
export function buildDemoPiece(fabric: FabricId): DemoPiece {
  const engine = new StitchEngine(
    createPiece({ id: `demo-${fabric}`, now: '2026-11-23T00:00:00.000Z', fabric, threads: demoThreads }),
  );
  const s = holeSpacing(fabric);
  const step = satinStep(fabric);
  const click = (p: Vec2) => engine.click(p);

  for (const thread of demoThreads) {
    const { sx, sy } = quadrants[thread.material];
    const local = (x: number, y: number): Vec2 => ({ x: sx * x, y: sy * y });
    engine.pickThread(thread.id);

    // 1) Satin block: slanted "/" stitches hugging the centre (up at A, down at B, up at the next A…).
    engine.setStitchType('satin');
    const H = Math.max(3, Math.round(7.2 / s)) * s;
    const n = Math.max(4, Math.round(8.1 / step) + 1);
    const span = (n - 1) * step + H;
    // Start on a hole so every click lands on one (a point exactly between holes is ambiguous).
    const x0 = Math.round((sx > 0 ? 1.5 : -(1.5 + span)) / s) * s;
    const y0 = Math.round((sy > 0 ? 1.5 : -(1.5 + H)) / s) * s;
    for (let i = 0; i < n; i++) {
      click({ x: x0 + i * step, y: y0 });
      click({ x: x0 + i * step + H, y: y0 + H });
    }
    engine.tieOff();

    // 2) Back-stitch S-curve: ~2.4 mm stitches sharing holes.
    engine.setStitchType('back');
    let acc = 0;
    let prev = curvePoint(0);
    click(local(prev.x, prev.y));
    const samples = 400;
    for (let k = 1; k <= samples; k++) {
      const p = curvePoint(k / samples);
      acc += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
      if (acc >= 2.4 || k === samples) {
        click(local(p.x, p.y)); // a click on the hole the thread is already in is simply ignored
        acc = 0;
      }
    }
    engine.tieOff();

    // 3) Running stitch: ~3 mm on top, ~1.8 mm underneath.
    engine.setStitchType('running');
    const r0 = { x: 1.5, y: 13.5 };
    const r1 = { x: 19, y: 26 };
    const rl = Math.hypot(r1.x - r0.x, r1.y - r0.y);
    for (let t = 0; t + 3 <= rl + 0.01; t += 4.8) {
      const pa = lerp(r0, r1, t / rl);
      const pb = lerp(r0, r1, Math.min(1, (t + 3) / rl));
      click(local(pa.x, pa.y));
      click(local(pb.x, pb.y));
    }
    engine.tieOff();

    // 4) Five French knots.
    engine.setStitchType('knot');
    for (const k of [
      { x: 27, y: 19 },
      { x: 31, y: 22.5 },
      { x: 35.5, y: 19.5 },
      { x: 39.5, y: 23 },
      { x: 33, y: 26 },
    ]) {
      click(local(k.x, k.y));
    }
    engine.tieOff();
  }

  return {
    threads: demoThreads,
    stitches: [...engine.stitches],
    knots: [...engine.knots],
    piece: structuredClone(engine.piece) as Piece,
  };
}

function curvePoint(t: number): Vec2 {
  return { x: 20 + 22 * t, y: 3 + 9 * t + 3 * Math.sin(2 * Math.PI * t) };
}

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Performance check: `count` random stitches spread over the hoop (spec M1: 60 fps with 20k). */
export function buildStressPiece(count: number, hoopDiameterMm = 150): DemoPiece {
  const rnd = mulberry32(1234);
  const stitches: Stitch[] = [];
  const R = hoopDiameterMm / 2 - 6;
  for (let i = 0; i < count; i++) {
    const r = R * Math.sqrt(rnd());
    const th = rnd() * Math.PI * 2;
    const a = { x: r * Math.cos(th), y: r * Math.sin(th) };
    const len = 1 + rnd() * 7;
    const dir = rnd() * Math.PI * 2;
    const b = { x: a.x + len * Math.cos(dir), y: a.y + len * Math.sin(dir) };
    const thread = demoThreads[Math.floor(rnd() * demoThreads.length)]!;
    stitches.push({ runId: 'stress', threadId: thread.id, a, b, side: 'front', seed: rnd(), order: i });
  }
  return { threads: demoThreads, stitches, knots: [] };
}
