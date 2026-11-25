// Hole lattices and snapping (spec 5.1). On woven fabrics the needle can only pass through the gaps
// the weave leaves, so every puncture lands exactly on a lattice hole that the fabric shader draws
// as a gap: plain weave between every pair of yarns, Aida at the block corners. Felt has no weave,
// so placement is free but quantised.
import { fabrics, tuning } from '../tuning';
import type { FabricId, Vec2 } from './types';

export function holeSpacing(fabric: FabricId): number {
  return fabrics[fabric].holeSpacingMm;
}

/** Integer lattice coordinates of a hole. Holes sit at (i·s, j·s); the hoop centre is a hole. */
export interface Hole {
  i: number;
  j: number;
  key: string;
  pos: Vec2;
}

export function holeAt(i: number, j: number, spacing: number): Hole {
  return { i, j, key: `${i},${j}`, pos: { x: round6(i * spacing), y: round6(j * spacing) } };
}

export function holeKeyOf(pos: Vec2, spacing: number): string {
  return `${Math.round(pos.x / spacing)},${Math.round(pos.y / spacing)}`;
}

export function nearestHole(p: Vec2, spacing: number): Hole {
  return holeAt(Math.round(p.x / spacing), Math.round(p.y / spacing), spacing);
}

/** Nearest lattice hole (kept for callers that only need a position). */
export function snapToLattice(p: Vec2, fabric: FabricId): Vec2 {
  return nearestHole(p, holeSpacing(fabric)).pos;
}

/** Radius inside which holes are valid (inner hoop radius minus margin). */
export function validRadius(hoopDiameterMm: number, marginMm = tuning.holeMarginMm): number {
  return hoopDiameterMm / 2 - marginMm;
}

export function isInsideHoop(pos: Vec2, hoopDiameterMm: number): boolean {
  return Math.hypot(pos.x, pos.y) <= validRadius(hoopDiameterMm) + 1e-9;
}

/** How many punctures use each hole (holes are shared by back and satin stitch). */
export class HoleIndex {
  private counts = new Map<string, number>();
  add(key: string): void {
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }
  remove(key: string): void {
    const n = (this.counts.get(key) ?? 0) - 1;
    if (n > 0) this.counts.set(key, n);
    else this.counts.delete(key);
  }
  count(key: string): number {
    return this.counts.get(key) ?? 0;
  }
  has(key: string): boolean {
    return this.counts.has(key);
  }
  get size(): number {
    return this.counts.size;
  }
  clear(): void {
    this.counts.clear();
  }
}

export type SnapKind = 'existing' | 'lattice' | 'invalid';

export interface SnapResult {
  kind: SnapKind; // existing = magnet to a used hole (ring drawn thicker); invalid = outside the hoop
  hole: Hole; // the hole the needle would go through (for invalid: the nearest one, unusable)
  distMm: number; // pointer → hole
}

export interface SnapContext {
  fabric: FabricId;
  hoopDiameterMm: number;
  holes: HoleIndex;
}

/**
 * Snap a pointer position to a hole. Priority (spec 5.1):
 * 1. an already-used hole within existingHoleMagnet × spacing, if it is no more than
 *    existingHoleBias × spacing farther than the nearest free hole;
 * 2. otherwise the nearest lattice hole within snapRadius × spacing;
 * 3. anything outside the hoop's inner radius minus the margin is invalid.
 */
export function snapPoint(p: Vec2, ctx: SnapContext): SnapResult {
  const s = holeSpacing(ctx.fabric);
  const near = nearestHole(p, s);
  const nearDist = dist(p, near.pos);
  let hole = near;
  let d = nearDist;
  let kind: SnapKind = ctx.holes.has(near.key) ? 'existing' : 'lattice';

  if (kind === 'lattice') {
    const R = tuning.existingHoleMagnet * s;
    const n = Math.ceil(R / s);
    let best: Hole | null = null;
    let bestD = Infinity;
    for (let dj = -n; dj <= n; dj++) {
      for (let di = -n; di <= n; di++) {
        const h = holeAt(near.i + di, near.j + dj, s);
        if (!ctx.holes.has(h.key)) continue;
        const hd = dist(p, h.pos);
        if (hd <= R && hd < bestD) {
          best = h;
          bestD = hd;
        }
      }
    }
    if (best && bestD - tuning.existingHoleBias * s <= nearDist) {
      hole = best;
      d = bestD;
      kind = 'existing';
    }
  }
  if (kind === 'lattice' && d > tuning.snapRadius * s) kind = 'invalid';
  if (!isInsideHoop(hole.pos, ctx.hoopDiameterMm)) kind = 'invalid';
  return { kind, hole, distMm: d };
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6 + 0; // + 0 turns -0 into 0
}
