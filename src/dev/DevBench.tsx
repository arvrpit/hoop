// Dev-only: synchronous GPU frame benchmark for the M1 performance check.
// window.__hoopBench(frames) renders `frames` frames back to back (including the shadow pass),
// forces the GPU to finish, and returns the average milliseconds per frame.
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

declare global {
  interface Window {
    __hoopBench?: (frames: number) => Promise<{ msPerFrame: number; width: number; height: number }>;
  }
}

export default function DevBench() {
  const advance = useThree((s) => s.advance);
  const gl = useThree((s) => s.gl);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const frameloop = useThree((s) => s.frameloop);
  useEffect(() => {
    window.__hoopBench = async (frames: number) => {
      setFrameloop('never');
      const ctx = gl.getContext();
      const px = new Uint8Array(4);
      const sync = () => ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
      advance(performance.now());
      sync();
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) advance(performance.now());
      sync();
      const ms = (performance.now() - t0) / frames;
      setFrameloop(frameloop);
      return { msPerFrame: ms, width: ctx.drawingBufferWidth, height: ctx.drawingBufferHeight };
    };
    return () => {
      delete window.__hoopBench;
    };
  }, [advance, gl, setFrameloop, frameloop]);
  return null;
}
