// Turns pointer, wheel and keyboard input into camera moves and stitching (spec 7). The camera only
// moves when the user zooms, pans or asks to fit; pointer moves only update the intent overlay (DOM),
// so aiming never redraws the 3D scene.
import { fitPxPerMm } from '../render/hoop/framing';
import { camera } from '../state/camera';
import { render } from '../state/render';
import { session, useSession } from '../state/session';
import { useHoop } from '../state/store';
import { useUi } from '../state/ui';
import { holeSpacing } from '../model/holes';
import type { StitchType, Vec2 } from '../model/types';
import { tuning } from '../tuning';
import type { IntentOverlay } from '../ui/intentOverlay';
import { isMac, toHoop, toScreen, wheelAction, type Frame } from './projection';

const stitchKeys: Record<string, StitchType> = { r: 'running', b: 'back', s: 'satin', k: 'knot' };

function editable(t: EventTarget | null): boolean {
  const e = t as HTMLElement | null;
  if (!e || !e.closest) return false;
  return !!e.closest('input, textarea, select, [contenteditable="true"], [data-look-panel]');
}

/** Lets the on-screen zoom control drive the same zoom as the keyboard. */
export const zoomHooks = { zoomBy: (_f: number) => {}, fit: () => {} };

declare global {
  interface Window {
    __hoopInteraction?: { frame: () => Frame; toScreen: (p: Vec2) => { x: number; y: number } };
  }
}

export function attachInteraction(el: HTMLElement, overlay: IntentOverlay, fadeEl: HTMLElement): () => void {
  let pointer: { x: number; y: number } | null = null; // relative to el
  let overCanvas = false;
  let spaceDown = false;
  let drag: {
    x: number;
    y: number;
    sx: number;
    sy: number;
    moved: boolean;
    pan: boolean;
    button: number;
  } | null = null;
  let altDown = false; // Alt/Option held: a click picks up the thread under the pointer
  let hold = 0; // long-press timer (the eyedropper)
  let lastView = '';
  let lastCut: number | null = null;

  const frame = (): Frame => {
    const r = el.getBoundingClientRect();
    return {
      width: r.width,
      height: r.height,
      pxPerMm: fitPxPerMm(r.width, r.height, useHoop.getState().hoopDiameterMm) * camera.view.zoom,
    };
  };
  const local = (e: MouseEvent) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function syncCamera(): void {
    const s = useHoop.getState();
    overlay.setReducedMotion(
      s.reducedMotion === 'system'
        ? typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
        : s.reducedMotion === 'on',
    );
    camera.reducedMotion =
      s.reducedMotion === 'system'
        ? typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
        : s.reducedMotion === 'on';
  }

  /** Stitch mode with the pointer over the fabric: this is when a click makes a hole (at any zoom). */
  function aiming(p: Vec2): boolean {
    return (
      useSession.getState().tool === 'stitch' &&
      !camera.gliding &&
      !(drag && (drag.moved || drag.pan)) &&
      !spaceDown &&
      !altDown &&
      Math.hypot(p.x, p.y) <= useHoop.getState().hoopDiameterMm / 2
    );
  }

  function refresh(): void {
    const f = frame();
    const v = camera.view;
    const p = pointer && overCanvas ? toHoop(pointer.x, pointer.y, f, v) : null;
    if (!pointer || !p || !aiming(p)) {
      overlay.set({ crosshair: null, ring: null, ghost: null, guide: null });
    } else {
      const pv = session.preview(p);
      const hole = toScreen(pv.snap.hole.pos, f, v);
      const r = Math.max(tuning.ringMinPx, 0.42 * holeSpacing(session.engine.piece.fabric) * f.pxPerMm);
      const kind =
        pv.snap.kind === 'invalid'
          ? 'invalid'
          : pv.crowd === 'full'
            ? 'full'
            : pv.crowd === 'warn'
              ? 'warn'
              : pv.snap.kind === 'existing'
                ? 'magnet'
                : 'normal';
      // Next click: a knot goes up and back down; otherwise the needle comes up (out) to start a run
      // or after a pass underneath, and goes down (in) to finish a stitch on top.
      const needle =
        session.engine.activeStitchType === 'knot' ? 'knot' : !pv.from || !pv.makesFront ? 'out' : 'in';
      overlay.set({
        crosshair: pointer,
        needle,
        ring: { ...hole, r, kind },
        ghost: pv.satinHint ? { ...toScreen(pv.satinHint, f, v), r } : null,
        guide:
          pv.from && kind !== 'invalid' && kind !== 'full'
            ? {
                from: toScreen(pv.from, f, v),
                to: hole,
                kind: pv.makesFront ? 'front' : 'back',
                slack: pv.slack || pv.refused,
              }
            : null,
      });
    }
    updateCursor(p);
  }

  function updateCursor(p: Vec2 | null): void {
    const tool = useSession.getState().tool;
    let c = 'default';
    if (drag?.pan && drag.moved) c = 'grabbing';
    else if (altDown && p && overCanvas) c = 'copy';
    else if (spaceDown || tool === 'view') c = 'grab';
    else if (p && aiming(p)) c = 'none';
    el.style.cursor = c;
  }

  function click(at: { x: number; y: number }): void {
    const f = frame();
    const p = toHoop(at.x, at.y, f, camera.view);
    if (camera.gliding) return;
    if (useSession.getState().tool !== 'stitch' || !aiming(p)) return;
    const res = session.click(p);
    if (res.status === 'refused') overlay.tug();
    if (res.status === 'crowded') overlay.tug();
    if (res.change && session.engine.piece.runs.some((r) => r.punctures.length > 0))
      useUi.getState().markSeen();
    refresh();
  }

  /** Pick up the thread of the stitch under a screen point. True if there was one. */
  function eyedrop(at: { x: number; y: number }, explicit: boolean): boolean {
    const f = frame();
    const t = session.threadAt(toHoop(at.x, at.y, f, camera.view), tuning.eyedropperSlopPx / f.pxPerMm);
    if (!t) {
      if (explicit)
        useUi.getState().showToast(`${isMac() ? 'Option' : 'Alt'}-click a stitch to pick up its thread`);
      return false;
    }
    const already = session.engine.piece.activeThreadId === t.id;
    session.pickThread(t.id);
    useUi.getState().showToast(already ? `${t.name} is already on the needle` : `Picked up ${t.name}`);
    return true;
  }

  const onPointerDown = (e: PointerEvent) => {
    if (!(e.target instanceof HTMLCanvasElement) || (e.button !== 0 && e.button !== 1)) return;
    const at = local(e);
    altDown = e.altKey;
    if (e.button === 0 && e.altKey) {
      eyedrop(at, true);
      e.preventDefault();
      refresh();
      return;
    }
    const pan = e.button === 1 || spaceDown || useSession.getState().tool === 'view';
    drag = { x: at.x, y: at.y, sx: at.x, sy: at.y, moved: false, pan, button: e.button };
    el.setPointerCapture(e.pointerId);
    if (e.button === 1) e.preventDefault();
    // Press and hold (without moving) on a stitch: pick up its thread instead of stitching.
    clearTimeout(hold);
    if (e.button === 0) {
      const d = drag;
      hold = window.setTimeout(() => {
        if (drag !== d || d.moved) return;
        if (eyedrop({ x: d.sx, y: d.sy }, false)) {
          drag = null; // the release doesn't stitch
          refresh();
        }
      }, tuning.longPressMs);
    }
  };
  const onPointerMove = (e: PointerEvent) => {
    altDown = e.altKey;
    overCanvas =
      e.target instanceof HTMLCanvasElement || (drag !== null && el.hasPointerCapture(e.pointerId));
    pointer = local(e);
    if (drag) {
      if (!drag.moved && Math.hypot(pointer.x - drag.sx, pointer.y - drag.sy) > tuning.dragThresholdPx)
        drag.moved = true;
      if (drag.moved && drag.pan) {
        const k = frame().pxPerMm;
        camera.pan(-(pointer.x - drag.x) / k, (pointer.y - drag.y) / k);
        render.invalidate();
      }
      drag.x = pointer.x;
      drag.y = pointer.y;
    }
    refresh();
  };
  const onPointerUp = (e: PointerEvent) => {
    clearTimeout(hold);
    if (el.hasPointerCapture(e.pointerId) && !drag) el.releasePointerCapture(e.pointerId);
    if (!drag) return;
    const d = drag;
    drag = null;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (!d.moved && d.button === 0) click(local(e));
    refresh();
  };
  const onLeave = () => {
    overCanvas = false;
    refresh();
  };
  const onDblClick = (e: MouseEvent) => {
    // With pointer capture the double-click lands on the container rather than the canvas.
    if (!(e.target instanceof HTMLCanvasElement) && e.target !== el) return;
    if (useSession.getState().tool === 'stitch' && session.tieOff()) refresh();
  };
  const onWheel = (e: WheelEvent) => {
    if (!(e.target instanceof HTMLCanvasElement)) return;
    e.preventDefault();
    const at = local(e);
    const f = frame();
    const a = wheelAction(e, isMac(), { wheel: tuning.wheelZoomSpeed, pinch: tuning.pinchZoomSpeed });
    if (a.kind === 'zoom') camera.zoomAt(a.factor, toHoop(at.x, at.y, f, camera.view));
    else camera.pan(a.dx / f.pxPerMm, -a.dy / f.pxPerMm);
    render.invalidate();
    refresh();
  };
  // Safari sends pinch as gesture events instead of ctrl+wheel.
  let gestureScale = 1;
  const onGestureStart = (e: Event) => {
    e.preventDefault();
    gestureScale = 1;
  };
  const onGestureChange = (e: Event) => {
    e.preventDefault();
    const scale = (e as unknown as { scale: number }).scale;
    if (!pointer) return;
    camera.zoomAt(scale / gestureScale, toHoop(pointer.x, pointer.y, frame(), camera.view));
    gestureScale = scale;
    render.invalidate();
    refresh();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Alt' && !altDown) {
      altDown = true;
      refresh();
    }
    if (editable(e.target) || document.querySelector('[data-modal]')) return;
    const key = e.key.toLowerCase();
    const mod = e.metaKey || e.ctrlKey;
    if (key === ' ') {
      if (!spaceDown) {
        spaceDown = true;
        refresh();
      }
      e.preventDefault();
      return;
    }
    if (mod && key === 'z') {
      if (e.shiftKey) session.redo();
      else session.undo();
      e.preventDefault();
    } else if (mod && key === 'y') {
      session.redo();
      e.preventDefault();
    } else if (mod || e.altKey) {
      return;
    } else if (key === 'h' || key === 'v') {
      session.setTool('view');
    } else if (stitchKeys[key]) {
      session.chooseStitch(stitchKeys[key]);
    } else if (key === 't') {
      session.tieOff();
    } else if (key === 'escape') {
      session.setTool('view');
    } else if (e.shiftKey && (e.code === 'Digit1' || key === '!')) {
      camera.fit(performance.now());
      render.invalidate();
    } else if (/^[1-9]$/.test(e.key) && !e.shiftKey) {
      const t = session.engine.piece.threads[Number(e.key) - 1];
      if (t) session.pickThread(t.id);
    } else if (key === '=' || key === '+' || key === '-' || key === '_') {
      zoomBy(key === '-' || key === '_' ? 1 / 1.25 : 1.25);
    } else if (e.key === '?') {
      useUi.getState().setLegend(!useUi.getState().legendOpen);
    } else return;
    refresh();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Alt' && altDown) {
      altDown = false;
      refresh();
    }
    if (e.key === ' ') {
      spaceDown = false;
      refresh();
    }
  };

  // Camera moved (Fit, zoom, pan): keep the overlay glued to the fabric. Reduced motion: fade.
  const onFrame = () => {
    const v = JSON.stringify(camera.view) + camera.mode + camera.gliding;
    if (v !== lastView) {
      lastView = v;
      refresh();
    }
    if (camera.lastCutAt !== null && camera.lastCutAt !== lastCut) {
      lastCut = camera.lastCutAt;
      fadeEl.animate([{ opacity: 0.55 }, { opacity: 0 }], {
        duration: tuning.reducedMotionCutMs,
        easing: 'ease-out',
      });
    }
  };
  render.onFrame.add(onFrame);

  /** Zoom about the centre of the screen (keyboard and the zoom control). */
  function zoomBy(factor: number): void {
    camera.zoomAt(factor, { ...camera.view.focus });
    render.invalidate();
  }
  zoomHooks.zoomBy = zoomBy;
  zoomHooks.fit = () => {
    camera.fit(performance.now());
    render.invalidate();
  };

  syncCamera();
  const offLook = useHoop.subscribe(syncCamera);
  const offTool = useSession.subscribe((s, prev) => {
    if (
      s.tool !== prev.tool ||
      s.stitchType !== prev.stitchType ||
      s.punctures !== prev.punctures ||
      s.thread !== prev.thread
    )
      refresh();
  });
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  mq?.addEventListener('change', syncCamera);

  window.__hoopInteraction = { frame, toScreen: (p) => toScreen(p, frame(), camera.view) };

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('dblclick', onDblClick);
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('gesturestart', onGestureStart);
  el.addEventListener('gesturechange', onGestureChange);
  const onBlur = () => {
    altDown = false;
    spaceDown = false;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  return () => {
    clearTimeout(hold);
    window.removeEventListener('blur', onBlur);
    render.onFrame.delete(onFrame);
    offLook();
    offTool();
    mq?.removeEventListener('change', syncCamera);
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerUp);
    el.removeEventListener('pointerleave', onLeave);
    el.removeEventListener('dblclick', onDblClick);
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('gesturestart', onGestureStart);
    el.removeEventListener('gesturechange', onGestureChange);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}
