// Camera for the hoop view, pure logic: no DOM, no three.js. Time is passed in, so it is testable.
// By decision (SPEC §14) the camera never moves by itself: you zoom and pan as you like so you can
// see the composition while stitching. The only animated move is Fit (button or Shift+1), which
// becomes an instant cut with reduced motion.
import { tuning } from '../tuning';
import type { Vec2 } from '../model/types';

export interface View {
  zoom: number; // 1 = whole hoop
  focus: Vec2; // hoop mm at the centre of the screen
}

export type CameraMode = 'overview' | 'focus' | 'manual';

export interface Viewport {
  width: number; // CSS px
  height: number;
  fitPxPerMm: number; // px per mm at zoom 1
}

interface Glide {
  from: View;
  to: View;
  t0: number;
  dur: number;
}

const OVERVIEW: View = { zoom: 1, focus: { x: 0, y: 0 } };

export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

export class CameraDirector {
  view: View = { zoom: 1, focus: { x: 0, y: 0 } };
  mode: CameraMode = 'overview';
  reducedMotion = false;
  /** Time of the last reduced-motion cut (the screen does a short fade), or null. */
  lastCutAt: number | null = null;
  private glide: Glide | null = null;
  private target: CameraMode = 'overview';

  get gliding(): boolean {
    return this.glide !== null;
  }

  /** Advance any glide. Returns true while the view is still changing. */
  update(now: number): boolean {
    const g = this.glide;
    if (!g) return false;
    const t = Math.min(1, (now - g.t0) / g.dur);
    const e = easeInOutSine(t);
    // Zoom moves in log space so the speed feels even; focus moves in a straight line.
    const z = Math.exp(Math.log(g.from.zoom) + (Math.log(g.to.zoom) - Math.log(g.from.zoom)) * e);
    this.view = {
      zoom: z,
      focus: {
        x: g.from.focus.x + (g.to.focus.x - g.from.focus.x) * e,
        y: g.from.focus.y + (g.to.focus.y - g.from.focus.y) * e,
      },
    };
    if (t >= 1) {
      this.view = { zoom: g.to.zoom, focus: { ...g.to.focus } };
      this.glide = null;
      this.mode = this.target;
      return false;
    }
    return true;
  }

  /** Fit the whole hoop in view (the user asked for it). */
  fit(now: number): void {
    if (this.mode === 'overview' && !this.glide) return;
    this.glideTo(OVERVIEW, tuning.fitMs, now, 'overview');
  }

  /** Scroll / pinch: zoom keeping the hoop point under the pointer still. */
  zoomAt(factor: number, anchor: Vec2): void {
    this.glide = null;
    const zoom = clamp(this.view.zoom * factor, 1, tuning.maxZoom);
    const r = this.view.zoom / zoom;
    this.view = {
      zoom,
      focus: {
        x: anchor.x + (this.view.focus.x - anchor.x) * r,
        y: anchor.y + (this.view.focus.y - anchor.y) * r,
      },
    };
    this.mode = zoom <= 1.0001 ? 'overview' : 'manual';
  }

  /** Two-finger swipe / Space+drag / drag in View mode. Delta in hoop mm. */
  pan(dx: number, dy: number): void {
    this.glide = null;
    this.view = { zoom: this.view.zoom, focus: { x: this.view.focus.x + dx, y: this.view.focus.y + dy } };
    if (this.mode === 'overview') this.mode = 'manual';
  }

  /** Jump without animating (look panel, URL, tests). */
  jumpTo(view: Partial<View>): void {
    this.glide = null;
    const zoom = clamp(view.zoom ?? this.view.zoom, 1, tuning.maxZoom);
    this.view = { zoom, focus: { ...(view.focus ?? this.view.focus) } };
    this.mode = zoom <= 1.0001 ? 'overview' : 'manual';
  }

  private glideTo(to: View, dur: number, now: number, mode: CameraMode): void {
    this.target = mode;
    if (this.reducedMotion) {
      this.glide = null;
      this.view = { zoom: to.zoom, focus: { ...to.focus } };
      this.mode = mode;
      this.lastCutAt = now;
      return;
    }
    this.glide = { from: { zoom: this.view.zoom, focus: { ...this.view.focus } }, to, t0: now, dur };
  }
}

function clamp(x: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, x));
}
