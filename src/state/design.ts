// The design traced inside the hoop: pen strokes and/or one placed image, in hoop millimetres
// (origin = hoop centre, +y up). Clipped to the hoop when drawn. Has its own undo.
import { create } from 'zustand';
import type { Vec2 } from '../model/types';

export interface Stroke {
  points: Vec2[];
  widthMm: number;
  erase: boolean;
}

export interface PlacedImage {
  src: string; // data URL
  pxW: number;
  pxH: number;
  x: number; // centre, hoop mm
  y: number;
  widthMm: number;
  rotationDeg: number;
}

interface DesignData {
  strokes: Stroke[];
  image: PlacedImage | null;
}

interface DesignState extends DesignData {
  visible: boolean; // shown on the fabric while stitching
  opacity: number;
  version: number; // bumps on every change (for redraws)
  past: DesignData[];
  begin: () => void; // snapshot for undo before a change
  set: (patch: Partial<DesignData & { visible: boolean; opacity: number }>) => void;
  addPoint: (p: Vec2) => void; // to the last stroke
  undo: () => void;
  clear: () => void;
}

export const penColor = '#2f56a8'; // like a washable transfer pen

export const useDesign = create<DesignState>((set, get) => ({
  strokes: [],
  image: null,
  visible: true,
  opacity: 0.6,
  version: 0,
  past: [],
  begin: () => {
    const { strokes, image, past } = get();
    set({ past: [...past.slice(-49), { strokes, image }] });
  },
  set: (patch) => set((s) => ({ ...patch, version: s.version + 1 })),
  addPoint: (p) =>
    set((s) => {
      const last = s.strokes[s.strokes.length - 1];
      if (!last) return s;
      const strokes = s.strokes.slice(0, -1).concat({ ...last, points: [...last.points, p] });
      return { strokes, version: s.version + 1 };
    }),
  undo: () => {
    const { past } = get();
    const prev = past[past.length - 1];
    if (!prev) return;
    set((s) => ({ ...prev, past: past.slice(0, -1), version: s.version + 1 }));
  },
  clear: () => {
    get().begin();
    set((s) => ({ strokes: [], image: null, version: s.version + 1 }));
  },
}));
