// Stitch engine (spec 5). Pure TypeScript: no React, no three.js.
// Every click is a puncture through a hole; stitches and knots are derived from the punctures of
// each run. The engine keeps the derived lists up to date incrementally (append on a new puncture,
// pop on undo) and reports each change as a ChangeSet so the renderer only touches what changed.
import { threadMaterials, tuning } from '../tuning';
import { History } from './history';
import {
  dist,
  holeAt,
  holeKeyOf,
  holeSpacing,
  HoleIndex,
  isInsideHoop,
  snapPoint,
  type SnapResult,
} from './holes';
import { hash01 } from './random';
import type { Knot, Piece, Puncture, Stitch, StitchType, Thread, ThreadRun, Vec2 } from './types';

export interface Derived {
  stitches: Stitch[];
  knots: Knot[];
}

export interface ChangeSet {
  added: Derived;
  removed: Derived;
  /** Holes whose use count changed (for dimples). */
  holes: Vec2[];
  /** Everything changed (e.g. a thread and its runs were removed): rebuild from scratch. */
  rebuild: boolean;
  /** Thread colours/materials or the thread list changed. */
  threadsChanged: boolean;
}

export type ClickStatus =
  | 'started' // first puncture of a new run: needle comes up, no stitch yet
  | 'stitched' // a visible front stitch was made
  | 'travel' // a hidden back travel was made (next stitch will be visible)
  | 'knot' // a French knot was made
  | 'refused' // over the hard length limit: the guideline tugs, nothing changes
  | 'same-hole' // clicked the hole the thread is already in
  | 'crowded' // the hole already has too many passes through it
  | 'invalid' // outside the hoop
  | 'no-thread'; // no thread on the needle

export interface ClickResult {
  status: ClickStatus;
  snap: SnapResult;
  /** The new stitch is over the soft limit (allowed, but it will snag). */
  slack: boolean;
  change: ChangeSet | null;
}

export interface Preview {
  snap: SnapResult;
  /** Where the thread currently is (last hole of the open run), or null when a click starts a run. */
  from: Vec2 | null;
  /** Next click makes a visible front stitch (solid guideline) rather than a back travel (dotted). */
  makesFront: boolean;
  lengthMm: number;
  slack: boolean;
  refused: boolean;
  /** Satin helper: suggested next "up" hole, or null. */
  satinHint: Vec2 | null;
  /** How busy the target hole would be: fine, getting crowded (warn), or full (click refused). */
  crowd: 'ok' | 'warn' | 'full';
}

type Op =
  | { kind: 'puncture'; runId: string; createdRun: ThreadRun | null; puncture: Puncture }
  | { kind: 'tieOff'; runId: string }
  | { kind: 'stitchType'; from: StitchType; to: StitchType; tiedRunId: string | null }
  | { kind: 'pickThread'; from: string | null; to: string; fromType: StitchType; toType: StitchType }
  | { kind: 'addThread'; thread: Thread; select: boolean; prevActive: string | null }
  | { kind: 'updateThread'; before: Thread; after: Thread }
  | {
      kind: 'removeThread';
      thread: Thread;
      index: number;
      runs: { run: ThreadRun; index: number }[];
      prevActive: string | null;
    };

// ---------------------------------------------------------------------------------------------
// Derivation (pure). The items created by puncture k of a run.

function stitchSeed(seq: number, side: 'front' | 'back'): number {
  return hash01(seq * 7919 + (side === 'front' ? 17 : 18));
}

export function deriveForPuncture(run: ThreadRun, k: number): Derived {
  const out: Derived = { stitches: [], knots: [] };
  const ps = run.punctures;
  const cur = ps[k];
  if (!cur) return out;
  const prev = ps[k - 1];
  const mk = (a: Vec2, b: Vec2, side: 'front' | 'back'): Stitch => ({
    runId: run.id,
    threadId: run.threadId,
    a,
    b,
    side,
    seed: stitchSeed(cur.seq, side),
    order: cur.seq,
  });
  switch (run.stitchType) {
    case 'knot':
      // Up and down in place; the travel from the previous knot runs underneath.
      if (prev) out.stitches.push(mk(prev.pos, cur.pos, 'back'));
      out.knots.push({
        runId: run.id,
        threadId: run.threadId,
        pos: cur.pos,
        seed: hash01(cur.seq * 104729 + 3),
        order: cur.seq,
      });
      break;
    case 'running':
    case 'satin':
      if (prev) out.stitches.push(mk(prev.pos, cur.pos, cur.dir === 'down' ? 'front' : 'back'));
      break;
    case 'back':
      // Every click after the first shows a stitch back to the previous hole. Underneath, the needle
      // travels from two holes back (from the previous hole for the second stitch).
      if (prev) {
        if (k >= 2) {
          const from = k === 2 ? prev : ps[k - 2]!;
          out.stitches.push(mk(from.pos, cur.pos, 'back'));
        }
        out.stitches.push(mk(prev.pos, cur.pos, 'front'));
      }
      break;
  }
  return out;
}

/** Full derivation of a piece, in creation order (used on load and after rebuilds). */
export function deriveAll(piece: Piece): Derived {
  const items: { seq: number; d: Derived }[] = [];
  for (const run of piece.runs) {
    run.punctures.forEach((p, k) => items.push({ seq: p.seq, d: deriveForPuncture(run, k) }));
  }
  items.sort((a, b) => a.seq - b.seq);
  return {
    stitches: items.flatMap((i) => i.d.stitches),
    knots: items.flatMap((i) => i.d.knots),
  };
}

/** Direction of the next puncture in a run with k punctures so far. */
function nextDir(type: StitchType, run: ThreadRun | null): 'up' | 'down' {
  const k = run?.punctures.length ?? 0;
  if (type === 'knot') return 'down'; // the needle ends on the back
  if (k === 0) return 'up';
  if (type === 'back') return k === 1 ? 'down' : 'up';
  return run!.punctures[k - 1]!.dir === 'up' ? 'down' : 'up';
}

function makesFrontStitch(type: StitchType, run: ThreadRun | null): boolean {
  const k = run?.punctures.length ?? 0;
  if (type === 'knot' || k === 0) return false;
  if (type === 'back') return true;
  return nextDir(type, run) === 'down';
}

function emptyChange(): ChangeSet {
  return {
    added: { stitches: [], knots: [] },
    removed: { stitches: [], knots: [] },
    holes: [],
    rebuild: false,
    threadsChanged: false,
  };
}

// ---------------------------------------------------------------------------------------------

export class StitchEngine {
  activeStitchType: StitchType;
  private p: Piece;
  private holes = new HoleIndex();
  private derived: Derived = { stitches: [], knots: [] };
  private history = new History<Op>();
  private seq = 0;
  private runNo = 0;

  constructor(piece: Piece, opts: { stitchType?: StitchType } = {}) {
    this.p = structuredClone(piece);
    this.activeStitchType = opts.stitchType ?? this.activeRun()?.stitchType ?? 'back';
    for (const run of this.p.runs) {
      const n = /^r(\d+)$/.exec(run.id);
      if (n) this.runNo = Math.max(this.runNo, Number(n[1]) + 1);
      for (const pu of run.punctures) this.seq = Math.max(this.seq, pu.seq + 1);
    }
    this.rebuildDerived();
  }

  /** The piece (read-only; take a structuredClone before storing or mutating it). */
  get piece(): Readonly<Piece> {
    return this.p;
  }
  get stitches(): readonly Stitch[] {
    return this.derived.stitches;
  }
  get knots(): readonly Knot[] {
    return this.derived.knots;
  }
  get canUndo(): boolean {
    return this.history.canUndo;
  }
  get canRedo(): boolean {
    return this.history.canRedo;
  }

  /** How many punctures use the hole at this position (0 = unused). */
  holeUseCount(pos: Vec2): number {
    return this.holes.count(holeKeyOf(pos, holeSpacing(this.p.fabric)));
  }

  activeThread(): Thread | null {
    return this.p.threads.find((t) => t.id === this.p.activeThreadId) ?? null;
  }

  /** The open (not tied off) run of a thread; defaults to the active thread. */
  openRun(threadId: string | null = this.p.activeThreadId): ThreadRun | null {
    if (!threadId) return null;
    for (let i = this.p.runs.length - 1; i >= 0; i--) {
      const r = this.p.runs[i]!;
      if (r.threadId === threadId && !r.tiedOff) return r;
    }
    return null;
  }

  activeRun(): ThreadRun | null {
    return this.openRun();
  }

  snap(point: Vec2): SnapResult {
    return snapPoint(point, {
      fabric: this.p.fabric,
      hoopDiameterMm: this.p.hoopDiameterMm,
      holes: this.holes,
    });
  }

  preview(point: Vec2): Preview {
    const snap = this.snap(point);
    const run = this.activeRun();
    const last = run?.punctures[run.punctures.length - 1] ?? null;
    const makesFront = makesFrontStitch(this.activeStitchType, run);
    const lengthMm = last ? dist(last.pos, snap.hole.pos) : 0;
    return {
      snap,
      from: last?.pos ?? null,
      makesFront,
      lengthMm,
      slack: makesFront && lengthMm > tuning.softMaxStitchMm,
      refused: makesFront && lengthMm > tuning.hardMaxStitchMm,
      satinHint: this.satinHint(run),
      crowd: this.crowdAt(snap.hole.pos),
    };
  }

  click(point: Vec2): ClickResult {
    const snap = this.snap(point);
    const none = (status: ClickStatus): ClickResult => ({ status, snap, slack: false, change: null });
    const thread = this.activeThread();
    if (!thread) return none('no-thread');
    if (snap.kind === 'invalid') return none('invalid');
    const type = this.activeStitchType;
    const run = this.activeRun();
    const last = run?.punctures[run.punctures.length - 1] ?? null;
    if (last && type !== 'knot' && dist(last.pos, snap.hole.pos) < 1e-9) return none('same-hole');
    const front = makesFrontStitch(type, run);
    const len = last ? dist(last.pos, snap.hole.pos) : 0;
    if (front && len > tuning.hardMaxStitchMm) return none('refused');
    if (this.crowdAt(snap.hole.pos) === 'full') return none('crowded');

    const puncture: Puncture = {
      id: `p${this.seq}`,
      pos: snap.hole.pos,
      dir: nextDir(type, run),
      seq: this.seq,
    };
    const createdRun: ThreadRun | null = run
      ? null
      : { id: `r${this.runNo}`, threadId: thread.id, stitchType: type, punctures: [], tiedOff: false };
    const change = this.exec({ kind: 'puncture', runId: run?.id ?? createdRun!.id, createdRun, puncture });
    const status: ClickStatus = type === 'knot' ? 'knot' : !run ? 'started' : front ? 'stitched' : 'travel';
    return { status, snap, slack: front && len > tuning.softMaxStitchMm, change };
  }

  /** Close the current run; the next click starts a new one (needle comes up). */
  tieOff(): ChangeSet | null {
    const run = this.activeRun();
    if (!run) return null;
    return this.exec({ kind: 'tieOff', runId: run.id });
  }

  /** Change stitch type. Ties off the current run if it has a different type. */
  setStitchType(type: StitchType): ChangeSet | null {
    if (type === this.activeStitchType) return null;
    const run = this.activeRun();
    const tiedRunId = run && run.stitchType !== type ? run.id : null;
    return this.exec({ kind: 'stitchType', from: this.activeStitchType, to: type, tiedRunId });
  }

  /** Pick up a thread. If it has an open run, the thread resumes from its last hole and its stitch type returns. */
  pickThread(threadId: string): ChangeSet | null {
    if (threadId === this.p.activeThreadId || !this.p.threads.some((t) => t.id === threadId)) return null;
    const toType = this.openRun(threadId)?.stitchType ?? this.activeStitchType;
    return this.exec({
      kind: 'pickThread',
      from: this.p.activeThreadId,
      to: threadId,
      fromType: this.activeStitchType,
      toType,
    });
  }

  addThread(thread: Thread, select = true): ChangeSet {
    return this.exec({
      kind: 'addThread',
      thread: structuredClone(thread),
      select,
      prevActive: this.p.activeThreadId,
    })!;
  }

  /** Edit a thread; every stitch made with it recolours (stitches reference threads by id). */
  updateThread(threadId: string, patch: Partial<Omit<Thread, 'id'>>): ChangeSet | null {
    const before = this.p.threads.find((t) => t.id === threadId);
    if (!before) return null;
    return this.exec({
      kind: 'updateThread',
      before: structuredClone(before),
      after: { ...structuredClone(before), ...patch, id: threadId },
    });
  }

  /** Remove a thread and unpick everything stitched with it. */
  removeThread(threadId: string): ChangeSet | null {
    const index = this.p.threads.findIndex((t) => t.id === threadId);
    if (index < 0) return null;
    const runs = this.p.runs
      .map((run, i) => ({ run: structuredClone(run), index: i }))
      .filter((r) => r.run.threadId === threadId);
    return this.exec({
      kind: 'removeThread',
      thread: structuredClone(this.p.threads[index]!),
      index,
      runs,
      prevActive: this.p.activeThreadId,
    });
  }

  /** Change the hoop size. Refused (false) if any hole would end up outside the smaller hoop. */
  setHoopDiameter(d: Piece['hoopDiameterMm']): boolean {
    if (d === this.p.hoopDiameterMm) return true;
    for (const run of this.p.runs) for (const pu of run.punctures) if (!isInsideHoop(pu.pos, d)) return false;
    this.p.hoopDiameterMm = d;
    return true;
  }

  /** 'warn' if this click would be the holeCrowdWarn-th pass through the hole, 'full' if it would exceed the limit. */
  crowdAt(pos: Vec2): 'ok' | 'warn' | 'full' {
    const next = this.holeUseCount(pos) + 1;
    if (next >= tuning.holeCrowdMax) return 'full';
    if (next >= tuning.holeCrowdWarn) return 'warn';
    return 'ok';
  }

  /** Number of visible stitches and knots made with a thread (for "This will unpick N stitches"). */
  countStitches(threadId: string): number {
    return (
      this.derived.stitches.filter((s) => s.threadId === threadId && s.side === 'front').length +
      this.derived.knots.filter((k) => k.threadId === threadId).length
    );
  }

  undo(): ChangeSet | null {
    const op = this.history.takeUndo();
    return op ? this.revert(op) : null;
  }

  redo(): ChangeSet | null {
    const op = this.history.takeRedo();
    return op ? this.apply(op) : null;
  }

  // -------------------------------------------------------------------------------------------

  private exec(op: Op): ChangeSet {
    const change = this.apply(op);
    this.history.record(op);
    return change;
  }

  private run(id: string): ThreadRun {
    const r = this.p.runs.find((x) => x.id === id);
    if (!r) throw new Error(`Unknown run ${id}`);
    return r;
  }

  private apply(op: Op): ChangeSet {
    const c = emptyChange();
    switch (op.kind) {
      case 'puncture': {
        if (op.createdRun) {
          this.p.runs.push({ ...structuredClone(op.createdRun), punctures: [] });
          this.runNo = Math.max(this.runNo, Number(op.createdRun.id.slice(1)) + 1);
        }
        const run = this.run(op.runId);
        run.punctures.push({ ...op.puncture, pos: { ...op.puncture.pos } });
        this.seq = Math.max(this.seq, op.puncture.seq + 1);
        const d = deriveForPuncture(run, run.punctures.length - 1);
        this.derived.stitches.push(...d.stitches);
        this.derived.knots.push(...d.knots);
        this.holes.add(holeKeyOf(op.puncture.pos, holeSpacing(this.p.fabric)));
        c.added = d;
        c.holes.push(op.puncture.pos);
        break;
      }
      case 'tieOff':
        this.run(op.runId).tiedOff = true;
        break;
      case 'stitchType':
        if (op.tiedRunId) this.run(op.tiedRunId).tiedOff = true;
        this.activeStitchType = op.to;
        break;
      case 'pickThread':
        this.p.activeThreadId = op.to;
        this.activeStitchType = op.toType;
        break;
      case 'addThread':
        this.p.threads.push(structuredClone(op.thread));
        if (op.select) this.p.activeThreadId = op.thread.id;
        c.threadsChanged = true;
        break;
      case 'updateThread':
        this.replaceThread(op.after);
        c.threadsChanged = true;
        break;
      case 'removeThread': {
        this.p.threads.splice(op.index, 1);
        const ids = new Set(op.runs.map((r) => r.run.id));
        this.p.runs = this.p.runs.filter((r) => !ids.has(r.id));
        if (this.p.activeThreadId === op.thread.id) this.p.activeThreadId = this.p.threads[0]?.id ?? null;
        this.rebuildDerived();
        c.rebuild = true;
        c.threadsChanged = true;
        break;
      }
    }
    return c;
  }

  private revert(op: Op): ChangeSet {
    const c = emptyChange();
    switch (op.kind) {
      case 'puncture': {
        const run = this.run(op.runId);
        const k = run.punctures.length - 1;
        const d = deriveForPuncture(run, k);
        this.derived.stitches.splice(this.derived.stitches.length - d.stitches.length, d.stitches.length);
        this.derived.knots.splice(this.derived.knots.length - d.knots.length, d.knots.length);
        run.punctures.pop();
        this.holes.remove(holeKeyOf(op.puncture.pos, holeSpacing(this.p.fabric)));
        if (op.createdRun) this.p.runs = this.p.runs.filter((r) => r.id !== op.runId);
        c.removed = d;
        c.holes.push(op.puncture.pos);
        break;
      }
      case 'tieOff':
        this.run(op.runId).tiedOff = false;
        break;
      case 'stitchType':
        if (op.tiedRunId) this.run(op.tiedRunId).tiedOff = false;
        this.activeStitchType = op.from;
        break;
      case 'pickThread':
        this.p.activeThreadId = op.from;
        this.activeStitchType = op.fromType;
        break;
      case 'addThread':
        this.p.threads = this.p.threads.filter((t) => t.id !== op.thread.id);
        this.p.activeThreadId = op.prevActive;
        c.threadsChanged = true;
        break;
      case 'updateThread':
        this.replaceThread(op.before);
        c.threadsChanged = true;
        break;
      case 'removeThread':
        this.p.threads.splice(op.index, 0, structuredClone(op.thread));
        for (const r of op.runs) this.p.runs.splice(r.index, 0, structuredClone(r.run));
        this.p.activeThreadId = op.prevActive;
        this.rebuildDerived();
        c.rebuild = true;
        c.threadsChanged = true;
        break;
    }
    return c;
  }

  private replaceThread(t: Thread): void {
    const i = this.p.threads.findIndex((x) => x.id === t.id);
    if (i >= 0) this.p.threads[i] = structuredClone(t);
  }

  private rebuildDerived(): void {
    this.derived = deriveAll(this.p);
    this.holes.clear();
    const s = holeSpacing(this.p.fabric);
    for (const run of this.p.runs) for (const pu of run.punctures) this.holes.add(holeKeyOf(pu.pos, s));
  }

  /**
   * Satin helper (spec 5.2): after a satin front stitch A→B, suggest the next "up" hole next to A,
   * perpendicular to A→B, on the side the user has been progressing (about one thread width away).
   */
  private satinHint(run: ThreadRun | null): Vec2 | null {
    if (!run || run.stitchType !== 'satin' || this.activeStitchType !== 'satin') return null;
    const ps = run.punctures;
    const k = ps.length - 1;
    if (k < 1 || ps[k]!.dir !== 'down') return null;
    const A = ps[k - 1]!.pos;
    const B = ps[k]!.pos;
    const len = dist(A, B);
    if (len < 1e-9) return null;
    let n = { x: -(B.y - A.y) / len, y: (B.x - A.x) / len };
    if (k >= 3 && ps[k - 2]!.dir === 'down') {
      const prevA = ps[k - 3]!.pos;
      if ((A.x - prevA.x) * n.x + (A.y - prevA.y) * n.y < 0) n = { x: -n.x, y: -n.y };
    }
    const s = holeSpacing(this.p.fabric);
    const thread = this.p.threads.find((t) => t.id === run.threadId);
    const width = thread ? threadMaterials[thread.material].widthPerStrandMm * thread.strands : s;
    const steps = Math.max(1, Math.round((width * 0.9) / s));
    let best: Vec2 | null = null;
    let bestDot = -Infinity;
    const ai = Math.round(A.x / s);
    const aj = Math.round(A.y / s);
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      const dot = (di * n.x + dj * n.y) / Math.hypot(di, dj);
      if (dot > bestDot) {
        bestDot = dot;
        best = holeAt(ai + di * steps, aj + dj * steps, s).pos;
      }
    }
    return best && isInsideHoop(best, this.p.hoopDiameterMm) ? best : null;
  }
}
