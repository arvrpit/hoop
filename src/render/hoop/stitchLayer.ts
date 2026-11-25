// Keeps the GPU instance buffers in step with the stitching session and plays the "action" side of
// stitching: pull-through, knot pop, dimple fade-in, and unpicking on undo. Only changed instances
// are uploaded. Stitch instances are kept in creation order, so the newest is always last.
import type { ChangeSet } from '../../model/stitchEngine';
import type { Thread, ThreadMaterial, Vec2 } from '../../model/types';
import type { RenderData } from '../../state/session';
import { tuning, type ThreadMaterialParams } from '../../tuning';
import type { GrowableInstances } from './instances';
import { createPieceBuffers, type PieceBuffers } from './pieceBuffers';
import { ThreadTable } from './threadTable';

type Materials = Record<ThreadMaterial, ThreadMaterialParams>;
type Kind = 'stitch' | 'knot' | 'dimple';

interface Anim {
  kind: Kind;
  index: number; // stitch / knot instance index
  key?: string; // dimple hole key (its index can move)
  t0: number;
  dur: number;
  from: number;
  to: number;
  ease: (t: number) => number;
  done?: () => void;
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeOutBack = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
const linear = (t: number) => t;

export class StitchLayer {
  readonly buffers: PieceBuffers = createPieceBuffers();
  readonly table = new ThreadTable(64);
  private anims: Anim[] = [];
  private unpicking = { stitch: 0, knot: 0 };
  private dimples = new Map<string, number>();
  private dimpleKeys: string[] = [];
  private dirty = new Map<GrowableInstances, [number, number]>();
  private holeKey: (p: Vec2) => string = (p) => `${p.x},${p.y}`;

  rebuild(data: RenderData, materials: Materials, holeKey: (p: Vec2) => string): void {
    this.anims = [];
    this.unpicking = { stitch: 0, knot: 0 };
    this.holeKey = holeKey;
    this.table.update(data.threads, materials);
    const front = data.stitches.filter((s) => s.side === 'front');
    const st = this.buffers.stitches;
    st.ensure(front.length);
    const ab = st.array('iAB');
    const meta = st.array('iMeta');
    front.forEach((s, i) => {
      ab.set([s.a.x, s.a.y, s.b.x, s.b.y], i * 4);
      meta.set([this.table.indexOf(s.threadId), s.seed, s.order, 1], i * 4);
    });
    st.commit(0, front.length, front.length);

    const kn = this.buffers.knots;
    kn.ensure(data.knots.length);
    const kk = kn.array('iKnot');
    const km = kn.array('iKnotMeta');
    data.knots.forEach((k, i) => {
      kk.set([k.pos.x, k.pos.y, this.table.indexOf(k.threadId), k.seed], i * 4);
      km.set([k.order, 1, 0, 0], i * 4);
    });
    kn.commit(0, data.knots.length, data.knots.length);

    this.dimples.clear();
    this.dimpleKeys = [];
    const dm = this.buffers.dimples;
    dm.ensure(data.holes.length);
    const dd = dm.array('iDimple');
    data.holes.forEach((p, i) => {
      const key = holeKey(p);
      this.dimples.set(key, i);
      this.dimpleKeys[i] = key;
      dd.set([p.x, p.y, tuning.dimpleOpacity, tuning.dimpleRadiusMm], i * 4);
    });
    dm.commit(0, data.holes.length, data.holes.length);
  }

  setThreads(threads: Thread[], materials: Materials): void {
    this.table.update(threads, materials);
  }

  /** Apply one change from the session. `holeUse` says how many punctures still use a hole. */
  apply(
    change: ChangeSet,
    threads: Thread[],
    materials: Materials,
    holeUse: (p: Vec2) => number,
    now: number,
    animate: boolean,
  ): void {
    if (change.threadsChanged) this.table.update(threads, materials);
    const remS = change.removed.stitches.filter((s) => s.side === 'front').length;
    const remK = change.removed.knots.length;
    if (remS || remK) this.unpick(remS, remK, now, animate);
    const addS = change.added.stitches.filter((s) => s.side === 'front');
    if (addS.length || change.added.knots.length) {
      this.flushUnpicks();
      this.append(addS, change.added.knots, now, animate);
    }
    for (const p of change.holes) this.updateDimple(p, holeUse(p), now, animate);
    this.flushDirty();
  }

  /** Advance animations; returns true while anything is still moving. */
  update(now: number): boolean {
    if (this.anims.length === 0) return false;
    const finished: Anim[] = [];
    for (const a of this.anims) {
      const t = Math.min(1, (now - a.t0) / a.dur);
      this.write(a, a.from + (a.to - a.from) * a.ease(t));
      if (t >= 1) finished.push(a);
    }
    if (finished.length) {
      this.anims = this.anims.filter((a) => !finished.includes(a));
      for (const a of finished) a.done?.();
    }
    this.flushDirty();
    return this.anims.length > 0;
  }

  /** Jump every animation to its end (before baking onto a product). */
  finishAnimations(): void {
    this.update(Number.POSITIVE_INFINITY);
  }

  get animating(): boolean {
    return this.anims.length > 0;
  }

  // ---------------------------------------------------------------------------------------------

  private append(
    stitches: RenderData['stitches'],
    knots: RenderData['knots'],
    now: number,
    animate: boolean,
  ): void {
    const st = this.buffers.stitches;
    if (stitches.length) {
      const start = st.count;
      st.ensure(start + stitches.length);
      const ab = st.array('iAB');
      const meta = st.array('iMeta');
      stitches.forEach((s, i) => {
        const idx = start + i;
        ab.set([s.a.x, s.a.y, s.b.x, s.b.y], idx * 4);
        meta.set([this.table.indexOf(s.threadId), s.seed, s.order, animate ? 0 : 1], idx * 4);
        if (animate)
          this.anims.push({
            kind: 'stitch',
            index: idx,
            t0: now,
            dur: tuning.pullThroughMs,
            from: 0,
            to: 1,
            ease: easeOutCubic,
          });
      });
      st.count = start + stitches.length;
      this.mark(st, start, st.count);
    }
    const kn = this.buffers.knots;
    if (knots.length) {
      const start = kn.count;
      kn.ensure(start + knots.length);
      const kk = kn.array('iKnot');
      const km = kn.array('iKnotMeta');
      knots.forEach((k, i) => {
        const idx = start + i;
        kk.set([k.pos.x, k.pos.y, this.table.indexOf(k.threadId), k.seed], idx * 4);
        km.set([k.order, animate ? 0.6 : 1, 0, 0], idx * 4);
        if (animate)
          this.anims.push({
            kind: 'knot',
            index: idx,
            t0: now,
            dur: tuning.knotPopMs,
            from: 0.6,
            to: 1,
            ease: easeOutBack,
          });
      });
      kn.count = start + knots.length;
      this.mark(kn, start, kn.count);
    }
  }

  /** The newest n stitches / knots pull back towards their start hole and fade, then go. */
  private unpick(nS: number, nK: number, now: number, animate: boolean): void {
    const st = this.buffers.stitches;
    const kn = this.buffers.knots;
    const s0 = st.count - this.unpicking.stitch - nS;
    const k0 = kn.count - this.unpicking.knot - nK;
    this.unpicking.stitch += nS;
    this.unpicking.knot += nK;
    const finish = () => {
      st.count -= nS;
      kn.count -= nK;
      this.unpicking.stitch -= nS;
      this.unpicking.knot -= nK;
      this.mark(st, st.count, st.count);
      this.mark(kn, kn.count, kn.count);
    };
    if (!animate) {
      finish();
      return;
    }
    let pending = nS + nK;
    const one = () => {
      if (--pending === 0) finish();
    };
    for (let i = 0; i < nS; i++) {
      this.anims.push({
        kind: 'stitch',
        index: s0 + i,
        t0: now,
        dur: tuning.unpickMs,
        from: -1,
        to: -0.0001,
        ease: linear,
        done: one,
      });
    }
    for (let i = 0; i < nK; i++) {
      this.anims.push({
        kind: 'knot',
        index: k0 + i,
        t0: now,
        dur: tuning.unpickMs,
        from: -1,
        to: -0.0001,
        ease: linear,
        done: one,
      });
    }
  }

  /** A new stitch arrives while others are still being unpicked: finish the unpicking now. */
  private flushUnpicks(): void {
    const pending = this.anims.filter(
      (a) => a.done && (a.kind === 'stitch' || a.kind === 'knot') && a.from < 0,
    );
    if (!pending.length) return;
    this.anims = this.anims.filter((a) => !pending.includes(a));
    for (const a of pending) a.done?.();
  }

  private updateDimple(p: Vec2, use: number, now: number, animate: boolean): void {
    const key = this.holeKey(p);
    const has = this.dimples.has(key);
    const dm = this.buffers.dimples;
    this.anims = this.anims.filter((a) => !(a.kind === 'dimple' && a.key === key));
    if (use > 0) {
      let idx = this.dimples.get(key);
      if (idx === undefined) {
        idx = dm.count;
        dm.ensure(idx + 1);
        dm.array('iDimple').set([p.x, p.y, 0, tuning.dimpleRadiusMm], idx * 4);
        this.dimples.set(key, idx);
        this.dimpleKeys[idx] = key;
        dm.count = idx + 1;
        this.mark(dm, idx, idx + 1);
      }
      const current = dm.array('iDimple')[idx * 4 + 2]!;
      if (animate) {
        this.anims.push({
          kind: 'dimple',
          index: idx,
          key,
          t0: now,
          dur: tuning.dimpleFadeMs,
          from: current,
          to: tuning.dimpleOpacity,
          ease: easeOutCubic,
        });
      } else this.write({ kind: 'dimple', index: idx, key } as Anim, tuning.dimpleOpacity);
    } else if (has) {
      const idx = this.dimples.get(key)!;
      const current = dm.array('iDimple')[idx * 4 + 2]!;
      const remove = () => this.removeDimple(key);
      if (animate) {
        this.anims.push({
          kind: 'dimple',
          index: idx,
          key,
          t0: now,
          dur: tuning.unpickMs,
          from: current,
          to: 0,
          ease: linear,
          done: remove,
        });
      } else remove();
    }
  }

  private removeDimple(key: string): void {
    const dm = this.buffers.dimples;
    const idx = this.dimples.get(key);
    if (idx === undefined) return;
    const last = dm.count - 1;
    const arr = dm.array('iDimple');
    if (idx !== last) {
      arr.copyWithin(idx * 4, last * 4, last * 4 + 4);
      const movedKey = this.dimpleKeys[last]!;
      this.dimples.set(movedKey, idx);
      this.dimpleKeys[idx] = movedKey;
    }
    this.dimples.delete(key);
    this.dimpleKeys.length = last;
    dm.count = last;
    this.mark(dm, idx, idx + 1);
  }

  private write(a: Pick<Anim, 'kind' | 'index' | 'key'>, v: number): void {
    if (a.kind === 'stitch') {
      this.buffers.stitches.array('iMeta')[a.index * 4 + 3] = v;
      this.mark(this.buffers.stitches, a.index, a.index + 1);
    } else if (a.kind === 'knot') {
      this.buffers.knots.array('iKnotMeta')[a.index * 4 + 1] = v;
      this.mark(this.buffers.knots, a.index, a.index + 1);
    } else {
      const idx = this.dimples.get(a.key!);
      if (idx === undefined) return;
      this.buffers.dimples.array('iDimple')[idx * 4 + 2] = v;
      this.mark(this.buffers.dimples, idx, idx + 1);
    }
  }

  private mark(buf: GrowableInstances, a: number, b: number): void {
    const r = this.dirty.get(buf);
    this.dirty.set(buf, r ? [Math.min(r[0], a), Math.max(r[1], b)] : [a, b]);
  }

  private flushDirty(): void {
    for (const [buf, [a, b]] of this.dirty) buf.commit(a, b, buf.count);
    this.dirty.clear();
  }

  dispose(): void {
    this.table.dispose();
    this.buffers.stitches.dispose();
    this.buffers.knots.dispose();
    this.buffers.dimples.dispose();
  }
}
