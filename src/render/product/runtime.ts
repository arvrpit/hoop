// Lets the screen-level flow talk to the product scene: face the hoop, ask which hoop sizes fit,
// wait until the scene is up, and capture what it shows.
let ready = false;
let waiters: (() => void)[] = [];

export const productRuntime = {
  /** Turn the camera to face the hoop; `framing` = visible height in hoop diameters. */
  faceHoop: async (_framing?: number): Promise<void> => {},
  fits: (_size: number): boolean => true,
  /** Draw now and copy the frame (scaled down to `maxWidth`, or at `pixelRatio`). */
  capture: (_opts: { maxWidth?: number; pixelRatio?: number }): HTMLCanvasElement | null => null,
  setReady(on: boolean): void {
    ready = on;
    if (on) {
      for (const w of waiters) w();
      waiters = [];
    }
  },
  /** Resolves once a product is on screen (its camera and controls exist). */
  whenReady(): Promise<void> {
    return ready ? Promise.resolve() : new Promise((r) => waiters.push(r));
  },
};
