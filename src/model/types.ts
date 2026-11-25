// Pure data model (spec section 4). No React or three.js in this folder.

export type Vec2 = { x: number; y: number }; // mm, hoop space, origin = hoop centre, +y up

export type FabricId = 'cotton' | 'linen' | 'aida14' | 'felt' | 'jersey' | 'canvas';
export type ThreadMaterial = 'floss' | 'perle' | 'silk' | 'wool';
export type StitchType = 'running' | 'back' | 'satin' | 'knot';

export interface HSL {
  h: number; // 0–360
  s: number; // 0–100
  l: number; // 0–100
}

export interface Thread {
  id: string;
  name: string;
  color: HSL;
  material: ThreadMaterial;
  strands: number; // 1–6, drives width
}

export interface Puncture {
  id: string;
  pos: Vec2; // snapped hole position
  dir: 'up' | 'down'; // needle coming up through the fabric, or going down
  seq: number; // global creation order across all runs (stacking + undo order)
}

export interface ThreadRun {
  id: string;
  threadId: string;
  stitchType: StitchType;
  punctures: Puncture[];
  tiedOff: boolean;
}

export interface Piece {
  id: string;
  version: 1;
  fabric: FabricId;
  fabricColor: HSL;
  hoopDiameterMm: 100 | 150 | 200;
  threads: Thread[];
  runs: ThreadRun[];
  activeThreadId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Derived (never stored): computed from runs by the stitch engine.
export interface Stitch {
  runId: string;
  threadId: string;
  a: Vec2;
  b: Vec2;
  side: 'front' | 'back';
  seed: number;
  order: number;
}

export interface Knot {
  runId: string;
  threadId: string;
  pos: Vec2;
  seed: number;
  order: number;
}
