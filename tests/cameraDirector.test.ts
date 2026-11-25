import { describe, expect, it } from 'vitest';
import { CameraDirector } from '../src/interaction/cameraDirector';
import { wheelAction } from '../src/interaction/projection';
import { tuning } from '../src/tuning';

function settle(c: CameraDirector, from: number, ms = 3000) {
  let t = from;
  while (c.update(t) && t < from + ms) t += 16;
  c.update(from + ms);
}

describe('camera (manual zoom only)', () => {
  it('starts with the whole hoop and never moves on its own', () => {
    const c = new CameraDirector();
    expect(c.mode).toBe('overview');
    c.jumpTo({ zoom: 3, focus: { x: 5, y: 5 } });
    const before = JSON.stringify(c.view);
    for (let t = 0; t < 30000; t += 100) expect(c.update(t)).toBe(false);
    expect(JSON.stringify(c.view)).toBe(before);
  });

  it('zooms about the pointer within fit … 8×; zooming out to fit is the whole hoop', () => {
    const c = new CameraDirector();
    c.zoomAt(2, { x: 10, y: 0 });
    expect(c.view.zoom).toBe(2);
    expect(c.view.focus.x).toBeCloseTo(5, 6);
    c.zoomAt(100, { x: 0, y: 0 });
    expect(c.view.zoom).toBe(tuning.maxZoom);
    c.zoomAt(0.001, { x: 0, y: 0 });
    expect(c.view.zoom).toBe(1);
    expect(c.mode).toBe('overview');
  });

  it('Fit glides back to the whole hoop, or cuts with reduced motion', () => {
    const c = new CameraDirector();
    c.jumpTo({ zoom: 4, focus: { x: 10, y: 3 } });
    c.fit(0);
    expect(c.gliding).toBe(true);
    settle(c, 0);
    expect(c.view).toEqual({ zoom: 1, focus: { x: 0, y: 0 } });

    c.reducedMotion = true;
    c.jumpTo({ zoom: 4 });
    c.fit(500);
    expect(c.gliding).toBe(false);
    expect(c.view.zoom).toBe(1);
    expect(c.lastCutAt).toBe(500);
  });

  it('pan and zoom cancel a Fit in progress', () => {
    const c = new CameraDirector();
    c.jumpTo({ zoom: 4 });
    c.fit(0);
    c.update(50);
    c.pan(1, 0);
    expect(c.gliding).toBe(false);
  });
});

describe('wheel on each platform', () => {
  const speeds = { wheel: 0.0015, pinch: 0.01 };
  const ev = (o: Partial<{ deltaX: number; deltaY: number; ctrlKey: boolean; metaKey: boolean }>) => ({
    deltaX: 0,
    deltaY: 0,
    deltaMode: 0,
    ctrlKey: false,
    metaKey: false,
    ...o,
  });
  it('macOS: two-finger swipe pans, pinch zooms, ⌘ + wheel zooms', () => {
    expect(wheelAction(ev({ deltaX: 10, deltaY: 20 }), true, speeds)).toEqual({
      kind: 'pan',
      dx: 10,
      dy: 20,
    });
    expect(wheelAction(ev({ deltaY: -10, ctrlKey: true }), true, speeds).kind).toBe('zoom');
    expect(wheelAction(ev({ deltaY: -10, metaKey: true }), true, speeds).kind).toBe('zoom');
  });
  it('Windows: the wheel zooms', () => {
    const a = wheelAction(ev({ deltaY: -100 }), false, speeds);
    expect(a.kind === 'zoom' && a.factor).toBeGreaterThan(1);
  });
});
