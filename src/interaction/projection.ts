// Screen ↔ hoop conversions for the current camera view.
import type { Vec2 } from '../model/types';
import type { View } from './cameraDirector';

export interface Frame {
  width: number;
  height: number;
  pxPerMm: number; // at the current zoom
}

export function toHoop(x: number, y: number, f: Frame, v: View): Vec2 {
  return { x: v.focus.x + (x - f.width / 2) / f.pxPerMm, y: v.focus.y - (y - f.height / 2) / f.pxPerMm };
}

export function toScreen(p: Vec2, f: Frame, v: View): { x: number; y: number } {
  return { x: f.width / 2 + (p.x - v.focus.x) * f.pxPerMm, y: f.height / 2 - (p.y - v.focus.y) * f.pxPerMm };
}

declare global {
  interface Window {
    __hoopPlatform?: 'mac' | 'win';
  }
}

/** macOS: two-finger swipe pans, pinch zooms. Elsewhere: wheel zooms, Space+drag pans. */
export function isMac(): boolean {
  if (typeof window !== 'undefined' && window.__hoopPlatform) return window.__hoopPlatform === 'mac';
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || '') || /Mac OS X/.test(navigator.userAgent);
}

export type WheelAction = { kind: 'zoom'; factor: number } | { kind: 'pan'; dx: number; dy: number };

/** What a wheel event means on this platform (dx/dy in screen px). Pure, so it is unit-tested. */
export function wheelAction(
  e: { deltaX: number; deltaY: number; deltaMode: number; ctrlKey: boolean; metaKey: boolean },
  mac: boolean,
  speeds: { wheel: number; pinch: number },
): WheelAction {
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  const dx = e.deltaX * unit;
  const dy = e.deltaY * unit;
  if (e.ctrlKey) return { kind: 'zoom', factor: Math.exp(-dy * speeds.pinch) }; // trackpad pinch
  if (mac && !e.metaKey) return { kind: 'pan', dx, dy }; // two-finger swipe
  return { kind: 'zoom', factor: Math.exp(-dy * speeds.wheel) }; // mouse wheel (⌘ + wheel on a Mac)
}
