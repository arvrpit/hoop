import { describe, expect, it } from 'vitest';
import { History } from '../src/model/history';
import { mulberry32 } from '../src/model/random';
import { at, engineFor, front, snapshot } from './helpers';

describe('History', () => {
  it('undoes and redoes in order; a new action clears redo', () => {
    const h = new History<number>();
    h.record(1);
    h.record(2);
    expect(h.takeUndo()).toBe(2);
    expect(h.canRedo).toBe(true);
    h.record(3);
    expect(h.canRedo).toBe(false);
    expect(h.takeUndo()).toBe(3);
    expect(h.takeUndo()).toBe(1);
    expect(h.takeUndo()).toBeUndefined();
  });
});

describe('undo and redo in the engine', () => {
  it('undo + redo returns to exactly the same state, at every step of a mixed session', () => {
    const e = engineFor();
    const rnd = mulberry32(5);
    const types = ['running', 'back', 'satin', 'knot'] as const;
    const states: string[] = [snapshot(e)];
    for (let n = 0; n < 200; n++) {
      const r = rnd();
      let changed: boolean;
      if (r < 0.06) changed = !!e.setStitchType(types[Math.floor(rnd() * 4)]!);
      else if (r < 0.1) changed = !!e.pickThread(['brown', 'green', 'red'][Math.floor(rnd() * 3)]!);
      else if (r < 0.13) changed = !!e.tieOff();
      else if (r < 0.15) changed = !!e.updateThread('green', { color: { h: rnd() * 360, s: 40, l: 40 } });
      else changed = !!e.click({ x: (rnd() - 0.5) * 30, y: (rnd() - 0.5) * 30 }).change;
      if (!changed) continue;
      const after = snapshot(e);
      e.undo();
      expect(snapshot(e)).toBe(states.at(-1));
      e.redo();
      expect(snapshot(e)).toBe(after);
      states.push(after);
    }
    while (e.canUndo) e.undo();
    expect(snapshot(e)).toBe(states[0]);
    while (e.canRedo) e.redo();
    expect(snapshot(e)).toBe(states.at(-1));
  });

  it('unpicking a stitch reports exactly what it removes, and redo puts it back', () => {
    const e = engineFor();
    e.setStitchType('back');
    e.click(at(0, 0));
    const made = e.click(at(5, 0)).change!;
    const undone = e.undo()!;
    expect(undone.removed).toEqual(made.added);
    expect(front(e)).toHaveLength(0);
    expect(e.holeUseCount(at(5, 0))).toBe(0);
    expect(e.holeUseCount(at(0, 0))).toBe(1);
    const redone = e.redo()!;
    expect(redone.added).toEqual(made.added);
  });

  it('removing a thread unpicks its stitches; undo brings them back', () => {
    const e = engineFor();
    e.setStitchType('back');
    [at(0, 0), at(5, 0), at(10, 0)].forEach((p) => e.click(p));
    e.pickThread('green');
    e.click(at(0, 5));
    e.click(at(5, 5));
    expect(e.countStitches('brown')).toBe(2);
    const before = snapshot(e);
    expect(e.removeThread('brown')!.rebuild).toBe(true);
    expect(e.countStitches('brown')).toBe(0);
    expect(e.piece.threads.map((t) => t.id)).toEqual(['green', 'red']);
    e.undo();
    expect(snapshot(e)).toBe(before);
  });
});
