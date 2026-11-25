// Dev-only hooks the app exposes on window (see src/dev/ and src/interaction/), as seen from Playwright.
export {};
declare global {
  interface Window {
    __hoop?: {
      set: (patch: Record<string, unknown>) => void;
      get: () => unknown;
      app: (patch?: Record<string, unknown>) => unknown;
      design: (patch?: Record<string, unknown>) => unknown;
      flush: (frames?: number) => Promise<void>;
      state: () => {
        tool: string;
        stitchType: string;
        camera: { mode: string; zoom: number; focus: { x: number; y: number }; gliding: boolean };
        front: number;
        knots: number;
        punctures: number;
        needle: { x: number; y: number } | null;
        animating: boolean;
        thread: string | null; // name of the thread on the needle
        threads: { name: string; hex: string; material: string; strands: number }[];
      };
    };
    __hoopProduct?: { faceHoop: (framing?: number) => void };
    __hoopFrames?: number;
    __hoopFps?: number;
    __hoopPlatform?: 'mac' | 'win';
    __hoopInteraction?: {
      frame: () => { width: number; height: number; pxPerMm: number };
      toScreen: (p: { x: number; y: number }) => { x: number; y: number };
    };
    __hoopBench?: (frames: number) => Promise<{ msPerFrame: number; width: number; height: number }>;
  }
}
