// Look and view settings (zustand). The stitching itself lives in session.ts; the camera in camera.ts.
// zoom/focus here mirror the camera (written by the renderer each frame it moves); setting them
// jumps the camera, which is how the look panel, URL parameters and tests position the view.
import { create } from 'zustand';
import type { FabricId, HSL, ThreadMaterial, Vec2 } from '../model/types';
import { fabrics, threadMaterials, tuning, type ThreadMaterialParams } from '../tuning';
import { camera } from './camera';

export type PieceSource = 'product' | 'blank' | 'demo' | 'stress';

export interface HoopState {
  fabric: FabricId;
  fabricColor: HSL;
  hoopDiameterMm: number;
  zoom: number; // mirror of the camera (1 = whole hoop)
  focus: Vec2; // mirror of the camera (hoop mm at screen centre)
  keyAzimuthDeg: number;
  keyElevationDeg: number;
  keyIntensity: number;
  ambientIntensity: number;
  lampFollowsCamera: boolean; // off by decision: the lamp stays still
  lampPos: Vec2;
  lampHeightMm: number;
  lampIntensity: number;
  lampRadiusMm: number | null;
  shadows: boolean;
  materials: Record<ThreadMaterial, ThreadMaterialParams>;
  source: PieceSource; // the product's piece, or (look panel) a blank hoop, the M1 demo, the 20k stress test
  stressCount: number;
  reducedMotion: 'system' | 'on' | 'off';
  alwaysRender: boolean; // render every frame (for frame-rate checks); otherwise only when something changes
  hideUi: boolean;
  hidePanel: boolean; // hide just the look panel (tests, recordings)
  set: (patch: Partial<Omit<HoopState, 'set'>>) => void;
}

export function initialState(overrides: Partial<Omit<HoopState, 'set'>> = {}): Omit<HoopState, 'set'> {
  const fabric = overrides.fabric ?? 'cotton';
  return {
    fabric,
    fabricColor: fabrics[fabric].defaultColor,
    hoopDiameterMm: tuning.hoopDefaultDiameterMm,
    zoom: 1,
    focus: { x: 0, y: 0 },
    keyAzimuthDeg: tuning.keyAzimuthDeg,
    keyElevationDeg: tuning.keyElevationDeg,
    keyIntensity: tuning.keyIntensity,
    ambientIntensity: tuning.ambientIntensity,
    lampFollowsCamera: false,
    lampPos: { x: 0, y: 0 },
    lampHeightMm: tuning.lampHeightMm,
    lampIntensity: tuning.lampIntensity,
    lampRadiusMm: null,
    shadows: true,
    materials: structuredClone(threadMaterials) as Record<ThreadMaterial, ThreadMaterialParams>,
    source: 'product',
    stressCount: 20000,
    reducedMotion: 'system',
    alwaysRender: false,
    hideUi: false,
    hidePanel: false,
    ...overrides,
  };
}

export const useHoop = create<HoopState>((set, get) => ({
  ...initialState(),
  set: (patch) => {
    const prev = get();
    const next = { ...patch };
    if (patch.fabric && patch.fabric !== prev.fabric && !patch.fabricColor) {
      next.fabricColor = fabrics[patch.fabric].defaultColor;
    }
    if (patch.zoom !== undefined || patch.focus !== undefined) {
      camera.jumpTo({ zoom: patch.zoom, focus: patch.focus });
      next.zoom = camera.view.zoom;
      next.focus = { ...camera.view.focus };
    }
    if (patch.source === 'stress' && patch.alwaysRender === undefined) next.alwaysRender = true;
    set(next);
  },
}));
