import { describe, expect, it } from 'vitest';
import { deriveAll } from '../src/model/stitchEngine';
import { mulberry32 } from '../src/model/random';
import { holeSpacing } from '../src/model/holes';
import { at, back, engineFor, front, seg } from './helpers';

describe('stitch types', () => {
  it('running: first click comes up, then down/up alternate (front, back, front…)', () => {
    const e = engineFor();
    e.setStitchType('running');
    const pts = [at(0, 0), at(6, 0), at(10, 0), at(16, 0), at(20, 0)];
    const statuses = pts.map((p) => e.click(p).status);
    expect(statuses).toEqual(['started', 'stitched', 'travel', 'stitched', 'travel']);
    expect(front(e).map(seg)).toEqual([
      [pts[0], pts[1]],
      [pts[2], pts[3]],
    ]);
    expect(back(e).map(seg)).toEqual([
      [pts[1], pts[2]],
      [pts[3], pts[4]],
    ]);
    expect(e.activeRun()!.punctures.map((p) => p.dir)).toEqual(['up', 'down', 'up', 'down', 'up']);
  });

  it('satin: alternates like running, and suggests the next up hole beside the last start', () => {
    const e = engineFor();
    e.setStitchType('satin');
    e.click(at(0, 0));
    e.click(at(0, 16));
    expect(e.preview(at(3, 0)).satinHint).not.toBeNull();
    // Progress to the right: the hint keeps going right.
    e.click(at(2, 0));
    e.click(at(2, 16));
    const hint = e.preview(at(5, 0)).satinHint!;
    expect(hint.x).toBeGreaterThan(at(2, 0).x);
    expect(front(e)).toHaveLength(2);
    expect(back(e)).toHaveLength(1);
  });

  it('back stitch: every click after the first makes a visible stitch from the previous hole', () => {
    const e = engineFor();
    e.setStitchType('back');
    const pts = [at(0, 0), at(5, 0), at(10, 1), at(15, 3)];
    pts.forEach((p) => e.click(p));
    expect(front(e).map(seg)).toEqual([
      [pts[0], pts[1]],
      [pts[1], pts[2]],
      [pts[2], pts[3]],
    ]);
    expect(back(e).map(seg)).toEqual([
      [pts[1], pts[2]],
      [pts[1], pts[3]],
    ]);
    expect(e.preview(at(20, 3)).makesFront).toBe(true);
  });

  it('French knot: every click makes a knot; the travel between knots is underneath', () => {
    const e = engineFor();
    e.setStitchType('knot');
    const pts = [at(0, 0), at(4, 4), at(8, 0)];
    expect(pts.map((p) => e.click(p).status)).toEqual(['knot', 'knot', 'knot']);
    expect(e.knots.map((k) => k.pos)).toEqual(pts);
    expect(back(e)).toHaveLength(2);
    expect(front(e)).toHaveLength(0);
    expect(e.activeRun()!.punctures.every((p) => p.dir === 'down')).toBe(true); // needle ends on the back
  });
});

describe('runs and thread switching', () => {
  it('switching back to a thread resumes its open run from the last hole', () => {
    const e = engineFor();
    e.setStitchType('back');
    e.click(at(0, 0));
    e.click(at(5, 0));
    const brownRun = e.activeRun()!.id;
    e.pickThread('green');
    e.setStitchType('satin');
    e.click(at(20, 20));
    e.click(at(20, 30));
    e.pickThread('brown');
    expect(e.activeStitchType).toBe('back'); // the run's stitch type comes back
    expect(e.preview(at(9, 0)).from).toEqual(at(5, 0));
    e.click(at(10, 0));
    expect(e.activeRun()!.id).toBe(brownRun);
    expect(
      front(e)
        .filter((s) => s.threadId === 'brown')
        .map(seg),
    ).toContainEqual([at(5, 0), at(10, 0)]);
  });

  it('tying off closes the run; the next click starts a new run with the needle coming up', () => {
    const e = engineFor();
    e.setStitchType('running');
    e.click(at(0, 0));
    e.click(at(5, 0));
    e.tieOff();
    expect(e.activeRun()).toBeNull();
    expect(e.click(at(10, 0)).status).toBe('started');
    expect(e.activeRun()!.punctures[0]!.dir).toBe('up');
    expect(e.piece.runs).toHaveLength(2);
  });

  it('changing stitch type mid-run ties off the run', () => {
    const e = engineFor();
    e.setStitchType('back');
    e.click(at(0, 0));
    e.click(at(5, 0));
    const first = e.activeRun()!.id;
    e.setStitchType('running');
    expect(e.piece.runs.find((r) => r.id === first)!.tiedOff).toBe(true);
    expect(e.click(at(10, 0)).status).toBe('started');
  });

  it('later stitches stack on top, even on a resumed run', () => {
    const e = engineFor();
    e.setStitchType('back');
    e.click(at(0, 0));
    e.click(at(5, 0));
    e.pickThread('green');
    e.click(at(0, 5));
    e.click(at(5, 5));
    e.pickThread('brown');
    e.click(at(10, 0));
    const orders = front(e).map((s) => s.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(front(e).at(-1)!.threadId).toBe('brown');
  });
});

describe('length limits', () => {
  it('a 15 mm stitch is allowed but slack; a 30 mm stitch is refused and nothing changes', () => {
    const e = engineFor();
    e.setStitchType('back');
    e.click(at(0, 0));
    const slack = e.click({ x: 15, y: 0 });
    expect(slack.status).toBe('stitched');
    expect(slack.slack).toBe(true);
    const before = JSON.stringify(e.piece);
    expect(e.preview({ x: 45, y: 0 }).refused).toBe(true);
    const refused = e.click({ x: 45, y: 0 });
    expect(refused.status).toBe('refused');
    expect(JSON.stringify(e.piece)).toBe(before);
    e.undo(); // the refused click left no history entry: undo removes the 15 mm stitch
    expect(front(e)).toHaveLength(0);
  });

  it('a long travel underneath is fine', () => {
    const e = engineFor();
    e.setStitchType('running');
    e.click(at(0, 0));
    e.click(at(5, 0));
    expect(e.click({ x: 40, y: 0 }).status).toBe('travel');
  });
});

describe('only real holes', () => {
  it('every puncture lands on a weave hole and clicks outside the hoop do nothing', () => {
    for (const fabric of ['cotton', 'linen', 'aida14', 'felt'] as const) {
      const e = engineFor(fabric);
      e.setStitchType('running');
      const s = holeSpacing(fabric);
      const rnd = mulberry32(3);
      for (let n = 0; n < 200; n++) e.click({ x: (rnd() - 0.5) * 30, y: (rnd() - 0.5) * 30 });
      for (const run of e.piece.runs)
        for (const p of run.punctures) {
          expect(Math.abs(p.pos.x / s - Math.round(p.pos.x / s))).toBeLessThan(1e-6);
          expect(Math.abs(p.pos.y / s - Math.round(p.pos.y / s))).toBeLessThan(1e-6);
        }
      const count = e.stitches.length;
      expect(e.click({ x: 80, y: 0 }).status).toBe('invalid');
      expect(e.stitches.length).toBe(count);
    }
  });

  it('clicking the hole the thread is already in does nothing', () => {
    const e = engineFor();
    e.click(at(0, 0));
    expect(e.click({ x: 0.05, y: 0.05 }).status).toBe('same-hole');
  });

  it('needs a thread on the needle', () => {
    const e = engineFor('cotton', []);
    expect(e.click(at(0, 0)).status).toBe('no-thread');
  });
});

describe('incremental derivation', () => {
  it('matches a full derivation of the piece', () => {
    const e = engineFor();
    const rnd = mulberry32(11);
    const types = ['running', 'back', 'satin', 'knot'] as const;
    for (let n = 0; n < 300; n++) {
      const r = rnd();
      if (r < 0.05) e.setStitchType(types[Math.floor(rnd() * 4)]!);
      else if (r < 0.08) e.pickThread(['brown', 'green', 'red'][Math.floor(rnd() * 3)]!);
      else if (r < 0.1) e.tieOff();
      else if (r < 0.15) e.undo();
      else e.click({ x: (rnd() - 0.5) * 40, y: (rnd() - 0.5) * 40 });
    }
    const full = deriveAll(e.piece);
    expect(e.stitches).toEqual(full.stitches);
    expect(e.knots).toEqual(full.knots);
  });
});

describe('reference tree scenario (spec section 1)', () => {
  it('trunk and branches in brown, satin leaves in green, back to brown to continue, red knots', () => {
    const e = engineFor('cotton');

    // Brown back-stitch trunk, going up, then a branch to the right.
    e.pickThread('brown');
    e.setStitchType('back');
    const trunk = [at(0, -40), at(0, -34), at(0, -28), at(0, -22), at(0, -16), at(1, -10), at(1, -4)];
    const branch = [at(6, 2), at(12, 7)];
    [...trunk, ...branch].forEach((p) => e.click(p));
    const brownRun = e.activeRun()!.id;
    expect(front(e)).toHaveLength(trunk.length + branch.length - 1);

    // Switch to green: satin leaves at the end of the branch.
    e.pickThread('green');
    e.setStitchType('satin');
    for (let i = 0; i < 6; i++) {
      e.click(at(14 + i, 8));
      e.click(at(18 + i, 16));
    }
    e.tieOff();
    const leafStitches = front(e).filter((s) => s.threadId === 'green');
    expect(leafStitches).toHaveLength(6);

    // Back to brown: the guideline starts where the branch left off, and the branch continues.
    e.pickThread('brown');
    expect(e.activeStitchType).toBe('back');
    expect(e.preview(at(18, 11)).from).toEqual(branch.at(-1));
    e.click(at(18, 11));
    expect(e.activeRun()!.id).toBe(brownRun);
    e.tieOff();

    // Red French knots as fruit.
    e.pickThread('red');
    e.setStitchType('knot');
    [at(4, 12), at(9, 14), at(-3, 9)].forEach((p) => e.click(p));
    expect(e.knots).toHaveLength(3);
    expect(e.knots.every((k) => k.threadId === 'red')).toBe(true);

    // The continued branch stitch sits on top of the leaves (made later).
    const lastBrown = front(e)
      .filter((s) => s.threadId === 'brown')
      .at(-1)!;
    expect(lastBrown.order).toBeGreaterThan(Math.max(...leafStitches.map((s) => s.order)));
    expect(e.piece.runs.map((r) => r.stitchType)).toEqual(['back', 'satin', 'knot']);
  });
});

describe('crowded holes', () => {
  it('warns from the 4th pass through a hole and refuses the 6th', () => {
    const e = engineFor();
    e.setStitchType('back');
    const hub = at(0, 0);
    // Back-stitch spokes in and out of one hub hole.
    e.click(hub);
    const rim = [at(6, 0), at(0, 6), at(-6, 0), at(0, -6), at(4, 4), at(-4, 4)];
    let i = 0;
    while (e.holeUseCount(hub) < 3) {
      e.click(rim[i++]!);
      e.click(hub);
    }
    e.click(rim[i++]!);
    expect(e.preview(hub).crowd).toBe('warn'); // would be the 4th
    e.click(hub);
    e.click(rim[i++]!);
    expect(e.preview(hub).crowd).toBe('warn'); // 5th
    e.click(hub);
    e.click(rim[i]!);
    expect(e.preview(hub).crowd).toBe('full'); // 6th refused
    const before = e.stitches.length;
    expect(e.click(hub).status).toBe('crowded');
    expect(e.stitches.length).toBe(before);
  });
});
