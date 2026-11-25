// The picker's live preview: a patch of satin stitches at real size, drawn with the real thread
// shader under the hoop's light, with the light slowly sweeping across so the sheen shows.
// Falls back to a plain CSS patch if it can't be drawn.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { hslToHex } from '../model/color';
import type { Thread } from '../model/types';
import { paintSwatch, whenSwatchesReady } from '../render/swatch/swatches';
import { useHoop } from '../state/store';
import { tuning } from '../tuning';

const PX = 144; // drawn at 2× its 72 px size

export function ThreadPreview({ thread }: { thread: Thread }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);
  const pref = useHoop((s) => s.reducedMotion);
  const hex = hslToHex(thread.color);
  const { material, strands } = thread;

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const t = { color: thread.color, material, strands };
    const still =
      pref === 'on' ||
      (pref === 'system' &&
        typeof matchMedia === 'function' &&
        matchMedia('(prefers-reduced-motion: reduce)').matches);
    let raf = 0;
    const cancel = whenSwatchesReady(() => {
      const t0 = performance.now();
      const ok = paintSwatch(c, t, 'preview', still ? null : 0);
      setDrawn(ok);
      if (!ok || still) return;
      let last = 0;
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        if (now - last < 1000 / tuning.previewFps) return;
        last = now;
        paintSwatch(c, t, 'preview', ((now - t0) % tuning.previewSweepMs) / tuning.previewSweepMs);
      };
      raf = requestAnimationFrame(tick);
    });
    return () => {
      cancel();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hex stands for the colour
  }, [hex, material, strands, pref]);

  return (
    <span
      className="hoop-thread-preview"
      role="img"
      aria-label={`Preview of ${thread.name || 'the thread'}`}
      data-material={material}
      data-drawn={drawn || undefined}
      style={{ '--c': hex, '--strands': strands } as CSSProperties}
    >
      <canvas ref={canvas} width={PX} height={PX} />
    </span>
  );
}
