import { useEffect, useState } from 'react';
import { session, useSession } from '../state/session';
import { useHoop } from '../state/store';

declare global {
  interface Window {
    __hoopFps?: number;
  }
}

/** Frames per second over the last second, plus the stitch count. */
export function FpsMeter() {
  const [fps, setFps] = useState(0);
  useSession((s) => s.punctures);
  useHoop((s) => s.source);
  const count = session.stitchCount();
  useEffect(() => {
    let raf = 0;
    // Counts frames actually drawn (the scene only draws when something changes).
    const samples: { t: number; n: number }[] = [];
    let lastShown = 0;
    const tick = (t: number) => {
      samples.push({ t, n: window.__hoopFrames ?? 0 });
      while (samples.length > 0 && t - samples[0]!.t > 1000) samples.shift();
      if (t - lastShown > 250 && samples.length > 1) {
        const a = samples[0]!;
        const b = samples[samples.length - 1]!;
        const v = ((b.n - a.n) * 1000) / Math.max(1, b.t - a.t);
        window.__hoopFps = v;
        setFps(v);
        lastShown = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        top: 10,
        font: '12px ui-monospace, SFMono-Regular, Menlo, monospace',
        color: 'rgba(245,236,224,0.9)',
        background: 'rgba(40,30,22,0.62)',
        padding: '4px 8px',
        borderRadius: 6,
        pointerEvents: 'none',
      }}
    >
      {fps.toFixed(0)} frames/s drawn · {count.toLocaleString()} stitches
    </div>
  );
}
