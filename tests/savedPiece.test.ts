import { describe, expect, it } from 'vitest';
import { cloneData, newPieceId, pieceName, summarise, type SavedPiece } from '../src/model/savedPiece';
import { StitchEngine } from '../src/model/stitchEngine';
import type { Piece } from '../src/model/types';
import { at, engineFor, front } from './helpers';

/** A small stitched piece: a back-stitch line, a tie-off, then a running line. */
function stitched(): StitchEngine {
  const e = engineFor();
  e.setStitchType('back');
  for (let i = 0; i <= 8; i += 2) e.click(at(i, 0));
  e.tieOff();
  e.setStitchType('running');
  for (let i = 0; i <= 8; i += 2) e.click(at(i, 6));
  return e;
}

const reopen = (e: StitchEngine) => new StitchEngine(cloneData(e.piece as Piece));

describe('saving a piece', () => {
  it('reopens with exactly the same stitches and knots', () => {
    const e = stitched();
    const r = reopen(e);
    expect(r.stitches).toEqual(e.stitches);
    expect(r.knots).toEqual(e.knots);
    expect(front(r).length).toBeGreaterThan(4);
  });

  it('keeps stitching after reopening, stacking new stitches on top', () => {
    const e = stitched();
    const r = reopen(e);
    const maxSeq = Math.max(...r.piece.runs.flatMap((run) => run.punctures.map((p) => p.seq)));
    r.tieOff();
    r.setStitchType('back');
    r.click(at(0, 12));
    r.click(at(4, 12));
    const added = r.piece.runs.flatMap((run) => run.punctures).filter((p) => p.seq > maxSeq);
    expect(added.length).toBe(2);
    expect(front(r).length).toBe(front(e).length + 1);
  });

  it('is a deep copy: changing the reopened piece leaves the saved one alone', () => {
    const e = stitched();
    const saved = cloneData(e.piece as Piece);
    const r = new StitchEngine(saved);
    r.click(at(20, 20));
    expect(saved).toEqual(cloneData(e.piece as Piece));
    expect(r.piece.runs).not.toBe(saved.runs);
  });

  it('summarises without the heavy parts', () => {
    const rec = {
      id: 'p-1',
      name: 'T-shirt · 1 Jan, 09:00',
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: '2026-01-02T09:00:00.000Z',
      product: 'tshirt',
      thumbnail: 'data:image/jpeg;base64,xx',
      piece: stitched().piece,
    } as unknown as SavedPiece;
    expect(summarise(rec)).toEqual({
      id: 'p-1',
      name: 'T-shirt · 1 Jan, 09:00',
      product: 'tshirt',
      updatedAt: '2026-01-02T09:00:00.000Z',
      thumbnail: 'data:image/jpeg;base64,xx',
    });
  });
});

describe('piece ids and names', () => {
  it('makes distinct ids', () => {
    const now = new Date('2026-11-24T22:40:00Z');
    let n = 0;
    const rand = () => (n++ * 0.37) % 1;
    const ids = new Set(Array.from({ length: 20 }, () => newPieceId(now, rand)));
    expect(ids.size).toBe(20);
    for (const id of ids) expect(id).toMatch(/^p-[0-9a-z]+-[0-9a-z]{4}$/);
  });
  it('names a piece after its product and the time', () => {
    const name = pieceName('Tote bag', new Date(2026, 10, 24, 22, 40));
    expect(name).toBe('Tote bag · 24 Nov, 22:40');
  });
});
