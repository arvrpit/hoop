// The intent layer (spec 7.2/7.3, as decided in SPEC §14): crosshair, hole ring, satin ghost ring and
// the faint guideline, plus four chevrons on the crosshair saying what the next click does: pointing
// in (the needle goes down into the fabric) or out (it comes up toward you); a French knot pulses
// out, then in. Drawn as interface in screen space, never as thread. Stitching itself only happens
// (and is rendered as real thread) once the user clicks the next hole.
import { tuning } from '../tuning';

const NS = 'http://www.w3.org/2000/svg';
type Pt = { x: number; y: number };

/** What the next click does with the needle: go down (in), come up (out), or both (a French knot). */
export type NeedleWay = 'in' | 'out' | 'knot';

export interface IntentState {
  crosshair: Pt | null;
  needle?: NeedleWay | null;
  ring: (Pt & { r: number; kind: 'normal' | 'magnet' | 'warn' | 'full' | 'invalid' }) | null;
  ghost: (Pt & { r: number }) | null;
  guide: { from: Pt; to: Pt; kind: 'front' | 'back'; slack: boolean } | null;
}

const HALO = 'rgba(255, 250, 242, 0.85)';
const INK = 'rgba(38, 30, 24, 1)';

function el<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export class IntentOverlay {
  readonly svg: SVGSVGElement;
  private cross: SVGGElement;
  private chevrons: SVGGElement;
  private chevronSpots: SVGGElement[] = [];
  private crossLines: SVGLineElement[] = [];
  private ringHalo: SVGCircleElement;
  private ring: SVGCircleElement;
  private ghost: SVGCircleElement;
  private guideHalo: SVGPathElement;
  private guide: SVGPathElement;
  private state: IntentState = { crosshair: null, ring: null, ghost: null, guide: null };
  private tugStart = -1;
  private tugs = 0;
  private raf = 0;

  constructor(container: HTMLElement) {
    this.svg = el('svg', { width: '100%', height: '100%', 'aria-hidden': 'true' });
    Object.assign(this.svg.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      overflow: 'visible',
    });
    this.guideHalo = el('path', { fill: 'none', stroke: HALO, 'stroke-width': 3, 'stroke-linecap': 'round' });
    this.guide = el('path', { fill: 'none', stroke: INK, 'stroke-width': 1.25, 'stroke-linecap': 'round' });
    this.ghost = el('circle', {
      fill: 'none',
      stroke: INK,
      'stroke-width': 1,
      'stroke-dasharray': '2 2.5',
      opacity: 0.3,
    });
    this.ringHalo = el('circle', { fill: 'none', stroke: HALO, 'stroke-width': 3.5 });
    this.ring = el('circle', { fill: 'none', stroke: INK, 'stroke-width': 1.5 });
    this.cross = el('g', {});
    for (let i = 0; i < 4; i++) {
      const halo = el('line', { stroke: HALO, 'stroke-width': 3, 'stroke-linecap': 'round' });
      const line = el('line', { stroke: INK, 'stroke-width': 1, 'stroke-linecap': 'round' });
      this.cross.append(halo, line);
      this.crossLines.push(halo, line);
    }
    // Chevrons: one at each compass point, in a frame whose +x points away from the aim point, so a
    // CSS translateX drifts it in or out. The animation itself is CSS (no redraws needed).
    this.chevrons = el('g', { class: 'hoop-chevrons' });
    const s = tuning.chevronSizePx;
    const shape = `M${-s * 0.6},${-s} L${s * 0.6},0 L${-s * 0.6},${s}`;
    for (const deg of [-90, 0, 90, 180]) {
      const spot = el('g', {});
      const turn = el('g', { transform: `rotate(${deg})` });
      const mover = el('g', { class: 'mover' });
      const face = el('g', { class: 'face' });
      face.append(
        el('path', {
          d: shape,
          fill: 'none',
          stroke: HALO,
          'stroke-width': 3,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
        el('path', {
          d: shape,
          fill: 'none',
          stroke: INK,
          'stroke-width': 1.4,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
      );
      mover.append(face);
      turn.append(mover);
      spot.append(turn);
      this.chevrons.append(spot);
      this.chevronSpots.push(spot);
    }
    const style = el('style', {});
    style.textContent = chevronCss();
    this.svg.append(
      style,
      this.guideHalo,
      this.guide,
      this.ghost,
      this.ringHalo,
      this.ring,
      this.cross,
      this.chevrons,
    );
    container.appendChild(this.svg);
    this.draw();
  }

  set(state: IntentState): void {
    this.state = state;
    this.draw();
  }

  /** Reduced motion: the chevrons hold still (they still point the right way). */
  setReducedMotion(on: boolean): void {
    this.svg.classList.toggle('rm', on);
  }

  /** The guideline gives a small tug: this stitch would be too long. */
  tug(): void {
    this.tugs++;
    this.svg.dataset.tugs = String(this.tugs);
    this.tugStart = performance.now();
    cancelAnimationFrame(this.raf);
    const step = () => {
      this.draw();
      if (performance.now() - this.tugStart < tuning.tugMs) this.raf = requestAnimationFrame(step);
      else {
        this.tugStart = -1;
        this.draw();
      }
    };
    this.raf = requestAnimationFrame(step);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.svg.remove();
  }

  private draw(): void {
    const { crosshair, ring, ghost, guide } = this.state;
    const d = this.svg.dataset;
    d.visible = crosshair ? '1' : '0';
    d.ring = ring ? ring.kind : 'none';
    d.guide = guide ? guide.kind : 'none';
    d.slack = guide?.slack ? '1' : '0';

    // Crosshair: four short arms around the pointer, leaving the aim point clear.
    this.cross.style.display = crosshair ? '' : 'none';
    if (crosshair) {
      const a = tuning.crosshairArmPx;
      const g = tuning.crosshairGapPx;
      const arms = [
        [crosshair.x - g - a, crosshair.y, crosshair.x - g, crosshair.y],
        [crosshair.x + g, crosshair.y, crosshair.x + g + a, crosshair.y],
        [crosshair.x, crosshair.y - g - a, crosshair.x, crosshair.y - g],
        [crosshair.x, crosshair.y + g, crosshair.x, crosshair.y + g + a],
      ];
      arms.forEach((arm, i) => {
        for (const line of [this.crossLines[i * 2]!, this.crossLines[i * 2 + 1]!]) {
          line.setAttribute('x1', String(arm[0]));
          line.setAttribute('y1', String(arm[1]));
          line.setAttribute('x2', String(arm[2]));
          line.setAttribute('y2', String(arm[3]));
        }
      });
      this.cross.setAttribute('opacity', ring?.kind === 'invalid' ? '0.45' : '0.9');
    }

    // Chevrons: which way the needle goes on the next click. Faint when the click would be refused.
    const way = crosshair && ring && ring.kind !== 'invalid' ? (this.state.needle ?? null) : null;
    d.needle = way ?? 'none';
    this.chevrons.style.display = way ? '' : 'none';
    if (way && crosshair) {
      this.chevrons.setAttribute('class', `hoop-chevrons ${way}`);
      this.chevrons.setAttribute('opacity', ring?.kind === 'full' ? '0.35' : '0.95');
      const r = tuning.chevronRadiusPx;
      const at = [
        [0, -r],
        [r, 0],
        [0, r],
        [-r, 0],
      ];
      this.chevronSpots.forEach((spot, i) =>
        spot.setAttribute('transform', `translate(${crosshair.x + at[i]![0]!},${crosshair.y + at[i]![1]!})`),
      );
    }

    // Ring on the hole the needle would go through (thicker when it snaps to a used hole).
    const showRing = !!ring && ring.kind !== 'invalid';
    for (const c of [this.ringHalo, this.ring]) {
      c.style.display = showRing ? '' : 'none';
      if (ring) {
        c.setAttribute('cx', String(ring.x));
        c.setAttribute('cy', String(ring.y));
        c.setAttribute('r', String(ring.r));
      }
    }
    if (ring) {
      // Thicker on a used hole; dashed when the hole is getting crowded; faint when it is full.
      this.ring.setAttribute('stroke-width', ring.kind === 'magnet' || ring.kind === 'warn' ? '2.5' : '1.5');
      this.ring.setAttribute('stroke-dasharray', ring.kind === 'warn' || ring.kind === 'full' ? '2.5 2' : '');
      const op = ring.kind === 'full' ? '0.4' : '1';
      this.ring.setAttribute('opacity', op);
      this.ringHalo.setAttribute('opacity', op);
    }

    this.ghost.style.display = ghost ? '' : 'none';
    if (ghost) {
      this.ghost.setAttribute('cx', String(ghost.x));
      this.ghost.setAttribute('cy', String(ghost.y));
      this.ghost.setAttribute('r', String(ghost.r));
    }

    // Guideline: solid and faint for a visible stitch, dotted for a pass underneath, wavy when too long.
    const showGuide = !!guide;
    this.guide.style.display = this.guideHalo.style.display = showGuide ? '' : 'none';
    if (guide) {
      const path = this.guidePath(guide);
      const base = guide.kind === 'front' ? tuning.guideFrontOpacity : tuning.guideBackOpacity;
      const op = guide.slack ? base * 0.7 : base;
      for (const p of [this.guideHalo, this.guide]) {
        p.setAttribute('d', path);
        p.setAttribute('stroke-dasharray', guide.kind === 'back' ? '1.5 5' : '');
      }
      this.guide.setAttribute('opacity', String(op));
      this.guideHalo.setAttribute('opacity', String(op * 0.8));
    }
  }

  private guidePath(g: NonNullable<IntentState['guide']>): string {
    const dx = g.to.x - g.from.x;
    const dy = g.to.y - g.from.y;
    const len = Math.hypot(dx, dy);
    const tugging = this.tugStart >= 0;
    if ((!g.slack && !tugging) || len < 1) return `M${g.from.x},${g.from.y}L${g.to.x},${g.to.y}`;
    const nx = -dy / len;
    const ny = dx / len;
    const t = tugging ? (performance.now() - this.tugStart) / tuning.tugMs : 0;
    const tugAmp = tugging ? 4 * (1 - t) * Math.sin(t * Math.PI * 6) : 0;
    const steps = Math.max(8, Math.round(len / 4));
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const env = Math.sin(Math.PI * u);
      const wave = g.slack ? 2 * Math.sin((u * len) / 7) * env : 0;
      const off = wave + tugAmp * env;
      d += `${i === 0 ? 'M' : 'L'}${g.from.x + dx * u + nx * off},${g.from.y + dy * u + ny * off}`;
    }
    return d;
  }
}

/** Keyframes for the chevrons. "out" drifts outward pointing out; "in" drifts inward pointing in; a
 *  knot does out, then in. Reduced motion (OS setting or the app's) holds them still. */
function chevronCss(): string {
  const t = tuning.chevronTravelPx;
  const ms = tuning.chevronCycleMs;
  return `
.hoop-chevrons .mover, .hoop-chevrons .face { transform-box: view-box; transform-origin: 0 0; }
.hoop-chevrons.in .face { transform: scaleX(-1); }
.hoop-chevrons.out .mover { animation: hoop-chev-out ${ms}ms ease-out infinite; }
.hoop-chevrons.in .mover { animation: hoop-chev-in ${ms}ms ease-in infinite; }
.hoop-chevrons.knot .mover { animation: hoop-chev-knot-move ${ms * 2}ms ease-in-out infinite; }
.hoop-chevrons.knot .face { animation: hoop-chev-knot-face ${ms * 2}ms steps(1, end) infinite; }
@keyframes hoop-chev-out {
  0% { transform: translateX(${-t * 0.6}px); opacity: 0; }
  25% { opacity: 1; }
  75% { opacity: 1; }
  100% { transform: translateX(${t}px); opacity: 0; }
}
@keyframes hoop-chev-in {
  0% { transform: translateX(${t}px); opacity: 0; }
  25% { opacity: 1; }
  75% { opacity: 1; }
  100% { transform: translateX(${-t * 0.6}px); opacity: 0; }
}
@keyframes hoop-chev-knot-move {
  0% { transform: translateX(${-t * 0.6}px); opacity: 0; }
  12% { opacity: 1; }
  38% { opacity: 1; }
  50% { transform: translateX(${t}px); opacity: 0; }
  62% { opacity: 1; }
  88% { opacity: 1; }
  100% { transform: translateX(${-t * 0.6}px); opacity: 0; }
}
@keyframes hoop-chev-knot-face {
  0% { transform: scaleX(1); }
  50% { transform: scaleX(-1); }
}
svg.rm .hoop-chevrons .mover, svg.rm .hoop-chevrons.knot .face { animation: none; opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .hoop-chevrons .mover, .hoop-chevrons.knot .face { animation: none !important; opacity: 1; }
}
`;
}
