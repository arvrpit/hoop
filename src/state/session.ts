// The stitching session: the stitch engine for the current piece, the active tool, and a change
// feed the renderer listens to (so it can animate exactly what changed).
import { create } from 'zustand';
import { buildDemoPiece, buildStressPiece } from '../model/demoPiece';
import { holeKeyOf, holeSpacing } from '../model/holes';
import { createPiece } from '../model/piece';
import { StitchEngine, type ChangeSet, type ClickResult, type Preview } from '../model/stitchEngine';
import { cloneData } from '../model/savedPiece';
import type { FabricId, Knot, Piece, Stitch, StitchType, Thread, Vec2 } from '../model/types';
import { tuning } from '../tuning';
import { threadUnder } from '../model/eyedropper';
import { useHoop, type PieceSource } from './store';

export type Tool = 'view' | 'stitch';

export const defaultThread: Thread = {
  id: 't-bark',
  name: 'Bark brown',
  color: { h: 25, s: 45, l: 30 },
  material: 'floss',
  strands: 2,
};

export interface SessionUi {
  tool: Tool;
  stitchType: StitchType;
  thread: Thread | null;
  threads: Thread[]; // the piece's threads, in rack order
  openThreadIds: string[]; // threads with an unfinished line (picking one up resumes it)
  canUndo: boolean;
  canRedo: boolean;
  punctures: number;
}

export const useSession = create<SessionUi>(() => ({
  tool: 'view',
  stitchType: 'running',
  thread: defaultThread,
  threads: [defaultThread],
  openThreadIds: [],
  canUndo: false,
  canRedo: false,
  punctures: 0,
}));

export interface RenderData {
  threads: Thread[];
  stitches: readonly Stitch[];
  knots: readonly Knot[];
  holes: Vec2[];
}

export type SessionEvent =
  | { kind: 'rebuild'; change?: ChangeSet } // change: an edit that needs a full rebuild (marks the piece unsaved)
  | { kind: 'do' | 'undo' | 'redo'; change: ChangeSet; result?: ClickResult }
  // Show these threads in place of the piece's (the picker's live preview); null puts them back.
  | { kind: 'previewThreads'; threads: Thread[] | null };

type Listener = (e: SessionEvent) => void;

class Session {
  engine: StitchEngine;
  private stress: { stitches: Stitch[]; holes: Vec2[] } | null = null;
  private listeners = new Set<Listener>();

  /** The product piece being worked on (one at a time); null until the hoop is first opened. */
  private current: StitchEngine | null = null;

  constructor() {
    this.engine = this.makeBlank('jersey', 150);
  }

  /** Open the current piece in the hoop with this fabric and hoop size (a blank one if needed). */
  activate(fabric: FabricId, hoopDiameterMm: number): boolean {
    let ok = true;
    if (!this.current || this.current.piece.fabric !== fabric) {
      this.current = this.makeBlank(fabric, hoopDiameterMm);
    } else ok = this.current.setHoopDiameter(hoopDiameterMm as 100 | 150 | 200);
    this.engine = this.current;
    this.stress = null;
    this.engine.setStitchType(useSession.getState().stitchType);
    this.syncUi();
    this.emit({ kind: 'rebuild' });
    return ok;
  }

  /** Has anything been stitched on the current piece? */
  pieceHasStitches(): boolean {
    const e = this.current;
    return !!e && e.stitches.length + e.knots.length > 0;
  }

  /** Would this hoop size still hold everything stitched on the current piece? */
  fitsHoop(hoopDiameterMm: number): boolean {
    const e = this.current;
    if (!e) return true;
    return e.piece.runs.every((r) =>
      r.punctures.every((p) => Math.hypot(p.pos.x, p.pos.y) <= hoopDiameterMm / 2 - 3),
    );
  }

  /** A copy of the current piece's data, for saving. */
  snapshot(): Piece | null {
    return this.current ? cloneData(this.current.piece as Piece) : null;
  }

  /** Drop the current piece (the next activate starts a blank one). */
  newPiece(): void {
    this.current = null;
  }

  /** Make a saved piece the current one (it opens in the hoop on the next activate). */
  loadPiece(piece: Piece): void {
    this.current = new StitchEngine(cloneData(piece), { stitchType: useSession.getState().stitchType });
  }

  hasStitches(): boolean {
    return this.engine.piece.runs.some((r) => r.punctures.length > 0);
  }

  onEvent(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  load(source: PieceSource, fabric: FabricId, stressCount: number): void {
    this.stress = null;
    if (source === 'product') return; // products manage their own pieces via activate()
    if (source === 'demo') {
      this.engine = new StitchEngine(buildDemoPiece(fabric).piece!, { stitchType: 'running' });
      this.engine.pickThread(this.engine.piece.threads[0]!.id);
    } else {
      this.engine = this.makeBlank(fabric, 150);
      if (source === 'stress') {
        const st = buildStressPiece(stressCount).stitches;
        const holes = new Map<string, Vec2>();
        for (const s of st) for (const p of [s.a, s.b]) holes.set(`${p.x},${p.y}`, p);
        this.stress = { stitches: st, holes: [...holes.values()] };
      }
    }
    this.engine.setStitchType(useSession.getState().stitchType);
    this.syncUi();
    this.emit({ kind: 'rebuild' });
  }

  renderData(): RenderData {
    if (this.stress) {
      return {
        threads: buildStressPiece(0).threads,
        stitches: this.stress.stitches,
        knots: [],
        holes: this.stress.holes,
      };
    }
    const holes = new Map<string, Vec2>();
    for (const run of this.engine.piece.runs)
      for (const p of run.punctures) holes.set(this.holeKey(p.pos), p.pos);
    return {
      threads: this.engine.piece.threads,
      stitches: this.engine.stitches,
      knots: this.engine.knots,
      holes: [...holes.values()],
    };
  }

  /** Visible stitch + knot count (for the frame-rate readout). */
  stitchCount(): number {
    return this.stress
      ? this.stress.stitches.length
      : this.engine.stitches.filter((s) => s.side === 'front').length + this.engine.knots.length;
  }

  holeKey(pos: Vec2): string {
    return holeKeyOf(pos, holeSpacing(this.engine.piece.fabric));
  }

  holeUseCount(pos: Vec2): number {
    return this.engine.holeUseCount(pos);
  }

  /** Last hole of the active thread's open run (where the needle is), or null. */
  needleAt(): Vec2 | null {
    const run = this.engine.activeRun();
    return run?.punctures[run.punctures.length - 1]?.pos ?? null;
  }

  setTool(tool: Tool): void {
    useSession.setState({ tool });
  }

  /** Pick a stitch type (enters Stitch mode). Changing type mid-run ties the run off. */
  chooseStitch(type: StitchType): void {
    const change = this.engine.setStitchType(type);
    useSession.setState({ tool: 'stitch' });
    this.syncUi();
    if (change) this.emit({ kind: 'do', change });
  }

  preview(point: Vec2): Preview {
    return this.engine.preview(point);
  }

  click(point: Vec2): ClickResult {
    const result = this.engine.click(point);
    if (result.change) {
      this.syncUi();
      this.emit({ kind: 'do', change: result.change, result });
    }
    return result;
  }

  /** Pick up a thread (enters Stitch mode). If it has an unfinished line, stitching resumes from its last hole. */
  pickThread(threadId: string): boolean {
    useSession.setState({ tool: 'stitch' });
    const change = this.engine.pickThread(threadId);
    this.syncUi();
    if (change) this.emit({ kind: 'do', change });
    return !!change;
  }

  /** Add a thread to the rack and put it on the needle. */
  addThread(thread: Thread): void {
    useSession.setState({ tool: 'stitch' });
    this.commit(this.engine.addThread(thread, true));
  }

  /** Edit a thread; everything stitched with it recolours. Undoable. */
  updateThread(threadId: string, patch: Partial<Omit<Thread, 'id'>>): void {
    this.commit(this.engine.updateThread(threadId, patch));
  }

  /** Remove a thread and unpick everything stitched with it. Undoable. */
  removeThread(threadId: string): void {
    this.commit(this.engine.removeThread(threadId));
  }

  /** Visible stitches and knots made with a thread. */
  stitchCountFor(threadId: string): number {
    return this.engine.countStitches(threadId);
  }

  /** Show the stitches in these threads for now (live preview while editing), or null to restore. */
  previewThreads(threads: Thread[] | null): void {
    this.emit({ kind: 'previewThreads', threads });
  }

  /** The thread of the topmost stitch or knot under a point (the eyedropper), or null. `slopMm`
   *  widens the reach (a few screen pixels, so the gaps between satin rows still count). */
  threadAt(p: Vec2, slopMm = 0): Thread | null {
    const e = this.engine;
    const reach = Math.max(tuning.eyedropperMinMm, slopMm);
    return threadUnder(p, e.stitches, e.knots, e.piece.threads, useHoop.getState().materials, reach);
  }

  tieOff(): boolean {
    const change = this.engine.tieOff();
    this.syncUi();
    if (change) this.emit({ kind: 'do', change });
    return !!change;
  }

  undo(): void {
    const change = this.engine.undo();
    this.syncUi();
    if (change) this.emit({ kind: change.rebuild ? 'rebuild' : 'undo', change });
  }

  redo(): void {
    const change = this.engine.redo();
    this.syncUi();
    if (change) this.emit({ kind: change.rebuild ? 'rebuild' : 'redo', change });
  }

  private commit(change: ChangeSet | null): void {
    this.syncUi();
    if (change) this.emit({ kind: change.rebuild ? 'rebuild' : 'do', change });
  }

  private emit(e: SessionEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  private syncUi(): void {
    const e = this.engine;
    useSession.setState({
      stitchType: e.activeStitchType,
      thread: e.activeThread(),
      threads: [...e.piece.threads],
      openThreadIds: e.piece.threads
        .filter((t) => (e.openRun(t.id)?.punctures.length ?? 0) > 0)
        .map((t) => t.id),
      canUndo: e.canUndo,
      canRedo: e.canRedo,
      punctures: e.piece.runs.reduce((n, r) => n + r.punctures.length, 0),
    });
  }

  private makeBlank(fabric: FabricId, hoopDiameterMm: number): StitchEngine {
    return new StitchEngine(
      createPiece({
        id: 'piece-1',
        now: new Date(0).toISOString(),
        fabric,
        threads: [defaultThread],
        hoopDiameterMm: hoopDiameterMm as 100 | 150 | 200,
      }),
      { stitchType: useSession.getState().stitchType },
    );
  }
}

export const session = new Session();

// Rebuild when the look panel / URL changes the fabric or the piece source.
useHoop.subscribe((s, prev) => {
  if (s.source === 'product') return;
  if (s.fabric !== prev.fabric || s.source !== prev.source || s.stressCount !== prev.stressCount) {
    session.load(s.source, s.fabric, s.stressCount);
  }
});
