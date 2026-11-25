// The eyedropper's hit test (spec 8.1): which thread's stitch or knot is under a point. A stitch
// counts if the point is within half its width of it (or `reachMm`, whichever is more); the topmost
// one wins (knots sit on top of stitches; later stitches on top of earlier ones).
import { knotSizeFactor, type ThreadMaterialParams } from '../tuning';
import type { Knot, Stitch, Thread, ThreadMaterial, Vec2 } from './types';

export function threadUnder(
  p: Vec2,
  stitches: readonly Stitch[],
  knots: readonly Knot[],
  threads: readonly Thread[],
  materials: Record<ThreadMaterial, ThreadMaterialParams>,
  reachMm = 0,
): Thread | null {
  const byId = new Map(threads.map((t) => [t.id, t]));
  const width = (id: string) => {
    const t = byId.get(id);
    return t ? materials[t.material].widthPerStrandMm * t.strands : 0;
  };
  let best: { order: number; id: string } | null = null;
  const consider = (order: number, id: string) => {
    if (!best || order >= best.order) best = { order, id };
  };
  for (const s of stitches) {
    if (s.side !== 'front') continue;
    if (distToSegment(p, s.a, s.b) <= Math.max(width(s.threadId) / 2, reachMm)) consider(s.order, s.threadId);
  }
  for (const k of knots) {
    const r = Math.max((width(k.threadId) * knotSizeFactor) / 2, reachMm);
    if (Math.hypot(p.x - k.pos.x, p.y - k.pos.y) <= r) consider(k.order + 1e9, k.threadId);
  }
  const found = best as { order: number; id: string } | null;
  return found ? (byId.get(found.id) ?? null) : null;
}

export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
